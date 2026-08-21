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
    VENV = "venv"
    CONDA = "conda"
    PIXI = "pixi"
    SYSTEM = "system"


class _PackageManager(StrEnum):
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


# TODO add env prefix arg
# TODO add package manager arg (and test with pip even when uv is available)
@lru_cache
def list_programs() -> list[Program]:
    """List installed programs in the environment."""
    env_kind = detect_environment()
    match _determine_env_package_manager(env_kind):
        case _PackageManager.PIP:
            return _list_pip_packages("pip")
        case _PackageManager.UV:
            return _list_pip_packages("uv")
        case _PackageManager.CONDA:
            return _list_conda_packages("conda")
        case _PackageManager.MAMBA:
            return _list_conda_packages("mamba")
        case _PackageManager.PIXI:
            return _list_pixi_packages()


def _list_pip_packages(manager: str) -> list[Program]:
    raw = _run_external_program_lister(
        [manager, "pip", "list", "--format=json"], name=manager
    )
    return [
        Program(name=item["name"], version=item["version"], kind=ProgramKind.PIP)
        for item in raw
    ]


def _list_conda_packages(manager: str) -> list[Program]:
    raw = _run_external_program_lister([manager, "list", "--json"], name=manager)
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
        for item in raw
    ]


def _list_pixi_packages() -> list[Program]:
    raw = _run_external_program_lister(["pixi", "list", "--json"], name="pixi")
    return [
        Program(
            name=item["name"],
            version=item["version"],
            kind=ProgramKind.PIP if item["kind"] == "pypi" else ProgramKind.CONDA,
        )
        for item in raw
    ]


def _run_external_program_lister(command: list[str], name: str) -> list[dict[str, str]]:
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


def _determine_env_package_manager(env_kind: EnvKind) -> _PackageManager:
    match env_kind:
        case EnvKind.VENV | EnvKind.SYSTEM:
            # Prefer uv over pip because it is faster
            return _PackageManager.UV if _uv_is_available() else _PackageManager.PIP
        case EnvKind.CONDA:
            # Prefer mamba over conda because it is faster
            return (
                _PackageManager.MAMBA
                if _mamba_is_available()
                else _PackageManager.CONDA
            )
        case EnvKind.PIXI:
            return _PackageManager.PIXI


def _uv_is_available() -> bool:
    return shutil.which("uv") is not None


def _mamba_is_available() -> bool:
    return shutil.which("mamba") is not None


# Duplicate of logging.get_logger to avoid importing from other modules
def _get_logger() -> logging.Logger:
    return logging.getLogger("scicat-widget")
