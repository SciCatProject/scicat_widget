# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

"""Environment detection and inspection."""

# IMPORTANT
# This module must not import 3rd part modules or from the rest of scicat_widget
# because it is used for tests in isolated environments.
# See tests/python/environment_test.py

import json
import logging
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from enum import StrEnum
from functools import lru_cache
from typing import Any


class ProgramKind(StrEnum):
    PIP = "pip"
    CONDA = "conda"
    SYSTEM = "system"


@dataclass(kw_only=True, frozen=True, slots=True)
class Program:
    name: str
    version: str
    kind: ProgramKind


class EnvKind(StrEnum):
    """The type of a Python (virtual) environment."""

    VENV = "venv"
    """A regular virtual Python environment.

    Might be managed by pip, uv, or another compatible tool.
    """
    CONDA = "conda"
    """A conda environment.

    Might be managed by conda, mamba, micromamba, or, in principle pixi.
    But the ``PIXI`` env kind is preferred.
    """
    PIXI = "pixi"
    """A pixi environment.

    Technically a conda environment but inspecting it with pixi is more efficient
    and provides more information. So we treat it as a separate kind of environment.
    """
    SYSTEM = "system"
    """Global or user environment."""


class PackageManager(StrEnum):
    """A Python package manager."""

    PIP = "pip"
    UV = "uv"
    CONDA = "conda"
    MAMBA = "mamba"
    PIXI = "pixi"


def detect_environment() -> EnvKind:
    """Determine which kind of environment the current process is running in."""
    # Check for pixi first because pixi envs are also conda envs.
    # Favor pixi because it gives better information and is faster.
    if "PIXI_PROJECT_MANIFEST" in os.environ:
        return EnvKind.PIXI
    # Check for conda before venv because conda envs are also venvs.
    if _in_conda_env():
        return EnvKind.CONDA
    if _in_virtual_env():
        return EnvKind.VENV
    return EnvKind.SYSTEM


def _in_conda_env() -> bool:
    # Conda usually defines some env vars, but CONDA_PREFIX seems to be deprecated.
    # To be more certain, also check for a `conda-meta` folder which is only
    # present when Python was installed with conda.
    if "CONDA_DEFAULT_ENV" in os.environ or "CONDA_PREFIX" in os.environ:
        return True
    conda_meta = os.path.join(sys.base_prefix, "conda-meta")
    return os.path.isdir(conda_meta)


def _in_virtual_env() -> bool:
    return sys.base_prefix != sys.prefix


@lru_cache
def list_programs(package_manager: PackageManager | None = None) -> list[Program]:
    """List installed programs in the environment.

    Uses a package manager to list the installed packages in the environment
    that this Python process is running in.

    Parameters
    ----------
    package_manager:
        Use the specified type of package manager.
        By default, this is deduced from the active environment.

    Returns
    -------
    :
        A list of all programs in the current environment.
    """
    manager = package_manager or _determine_env_package_manager(detect_environment())

    match manager:
        case PackageManager.PIP:
            return _list_pip_packages()
        case PackageManager.UV:
            return _list_uv_packages()
        case PackageManager.CONDA:
            return _list_conda_packages("conda")
        case PackageManager.MAMBA:
            return _list_conda_packages("mamba")
        case PackageManager.PIXI:
            return _list_pixi_packages()


def _list_pip_packages() -> list[Program]:
    raw = _run_external_program_lister(
        [sys.executable, "-m", "pip", "list", "--format=json"], name="pip"
    )
    return [
        Program(name=item["name"], version=item["version"], kind=ProgramKind.PIP)
        for item in raw
    ]


def _list_uv_packages() -> list[Program]:
    uv = require_program("uv")
    raw = _run_external_program_lister(
        [uv, "pip", "list", "--format=json", "-p", sys.executable], name="uv"
    )
    return [
        Program(name=item["name"], version=item["version"], kind=ProgramKind.PIP)
        for item in raw
    ]


def _list_conda_packages(manager: str) -> list[Program]:
    conda = require_program(manager)
    raw = _run_external_program_lister([conda, "list", "--json"], name=manager)

    # The output can be a dict or a list depending on `manager`
    packages: list[dict[str, str]] = raw["packages"] if isinstance(raw, dict) else raw

    # Conda lists channel="pypi" for pip packages. But probably only if they are from
    # pypi.org, if they are from a different index, we will falsely
    # classify them as conda packages.
    return [
        Program(
            name=item["name"],
            version=item["version"],
            kind=ProgramKind.PIP
            if item.get("channel", "") == "pypi"
            else ProgramKind.CONDA,
        )
        for item in packages
    ]


def _list_pixi_packages() -> list[Program]:
    pixi = require_program("pixi")
    raw = _run_external_program_lister([pixi, "list", "--json"], name="pixi")
    return [
        Program(
            name=item["name"],
            version=item["version"],
            kind=ProgramKind.PIP if item["kind"] == "pypi" else ProgramKind.CONDA,
        )
        for item in raw
    ]


def _run_external_program_lister(command: list[str], name: str) -> Any:
    # uv installs packages into a standard venv
    try:
        result = subprocess.run(  # noqa: S603
            command,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as error:
        _get_logger().error(
            "Listing %s packages failed with\nSTDOUT:\n%s\n\nSTDERR:\n%s",
            name,
            error.stdout,
            error.stderr,
        )
        return []


def _determine_env_package_manager(env_kind: EnvKind) -> PackageManager:
    match env_kind:
        case EnvKind.VENV | EnvKind.SYSTEM:
            # Prefer uv over pip because it is faster
            return PackageManager.UV if locate_uv() else PackageManager.PIP
        case EnvKind.CONDA:
            # Prefer mamba over conda because it is faster
            return PackageManager.MAMBA if locate_mamba() else PackageManager.CONDA
        case EnvKind.PIXI:
            return PackageManager.PIXI


# Duplicate of logging.get_logger to avoid importing from other modules
def _get_logger() -> logging.Logger:
    return logging.getLogger("scicat-widget")


def locate_uv() -> str | None:
    """Find the path to the uv executable if it is available.

    Returns
    -------
    :
        - ``SCITACEAN_UV_EXECUTABLE`` if it is set
        - A ``uv`` executable on ``PATH`` if it exists
        - ``None`` otherwise.
    """
    return _locate_program("uv")


def locate_mamba() -> str | None:
    """Find the path to the mamba executable if it is available.

    Returns
    -------
    :
        - ``SCITACEAN_MAMBA_EXECUTABLE`` if it is set
        - A ``mamba`` executable on ``PATH`` if it exists
        - ``None`` otherwise.
    """
    return _locate_program("mamba")


def _locate_program(name: str) -> str | None:
    if override := os.environ.get(_program_env_var(name)):
        return override
    return shutil.which(name)


def _program_env_var(name: str) -> str:
    return f"SCITACEAN_{name.upper()}_EXECUTABLE"


def require_program(name: str) -> str:
    """Find a program and raise if it is unavailable."""
    if exe := _locate_program(name):
        return exe
    raise RuntimeError(
        f"Unable to find {name}. Consider setting {_program_env_var(name)}"
    )
