"""Test environment inspection.

These tests require
    - conda
    - mamba
    - pixi
    - uv

If they are installed but cannot be found automatically, set the environment variables:
    - SCITACEAN_CONDA_EXECUTABLE
    - SCITACEAN_MAMBA_EXECUTABLE
    - SCITACEAN_PIXI_EXECUTABLE
    - SCITACEAN_UV_EXECUTABLE
"""

import dataclasses
import json
import os
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scicat_widget._environment import EnvKind, Program, ProgramKind, require_program

_PYTHON_VERSION = "3.14"


@pytest.fixture(scope="session")
def skip_unless_enabled(pytestconfig: pytest.Config) -> None:
    if not pytestconfig.getoption("--env-tests"):
        pytest.skip("Environment tests are not enabled")


def _venv_runner(prefix: Path) -> list[str]:
    if os.name == "nt":
        python = prefix / "Scripts" / "python.exe"
    else:
        python = prefix / "bin" / "python"
    return [os.fspath(python)]


def _uv_runner(prefix: Path) -> list[str]:
    return [
        require_program("uv"),
        "run",
        "-p",
        os.fspath(prefix.joinpath("bin", "python")),
        "python",
    ]


def _pixi_runner(prefix: Path) -> list[str]:
    return [
        require_program("pixi"),
        "run",
        "-m",
        os.fspath(prefix),
        "python",
    ]


def _conda_runner(conda: str) -> Callable[[Path], list[str]]:
    def impl(prefix: Path) -> list[str]:
        return [require_program(conda), "run", "-p", os.fspath(prefix), "python"]

    return impl


def _call_program(args: list[str | Path], cwd: Path | None = None):
    try:
        _ = subprocess.run(  # noqa: S603
            args, capture_output=True, check=True, text=True, cwd=cwd
        )
    except subprocess.CalledProcessError as error:
        _print_captured_output(error)
        raise


def _pip_create_env(prefix: Path, programs: list[Program]) -> None:
    _call_program(["python", "-m", "venv", prefix])
    _call_program(
        [
            prefix / "bin" / "python",
            "-m",
            "pip",
            "install",
            "--prefix",
            prefix,
            *(f"{p.name}=={p.version}" for p in programs),
        ]
    )


def _uv_create_env(prefix: Path, programs: list[Program]) -> None:
    uv = require_program("uv")
    _call_program([uv, "venv", "-p", _PYTHON_VERSION, prefix])
    _call_program(
        [
            uv,
            "pip",
            "install",
            "-p",
            _PYTHON_VERSION,
            "--prefix",
            prefix,
            *(f"{p.name}=={p.version}" for p in programs),
        ]
    )


def _pixi_create_env(prefix: Path, programs: list[Program]) -> None:
    prefix.mkdir(parents=True, exist_ok=False)
    dependencies = "\n".join(
        f'{p.name} = "=={p.version}"' for p in programs if p.kind == ProgramKind.CONDA
    )
    pypi_dependencies = "\n".join(
        f'{p.name} = "=={p.version}"' for p in programs if p.kind == ProgramKind.PIP
    )
    prefix.joinpath("pixi.toml").write_text(f"""
[workspace]
authors = []
channels = ["conda-forge"]
name = "pixi"
version = "1.0"
platforms = ["linux-64", "osx-64", "osx-arm64", "win-64"]
[dependencies]
{dependencies}
[pypi-dependencies]
{pypi_dependencies}
""")

    pixi = require_program("pixi")
    _call_program([pixi, "install"], cwd=prefix)


def _conda_create_env(conda: str) -> Callable[[Path, list[Program]], None]:
    conda = require_program(conda)

    def impl(prefix: Path, programs: list[Program]) -> None:
        conda_programs = [p for p in programs if p.kind == ProgramKind.CONDA]
        pip_programs = [p for p in programs if p.kind == ProgramKind.PIP]
        if pip_programs:
            conda_programs.append(
                Program(name="pip", version="26.2.1", kind=ProgramKind.CONDA)
            )
        _call_program(
            [
                conda,
                "create",
                "--yes",
                "-p",
                prefix,
                *(f"{p.name}={p.version}" for p in conda_programs),
            ]
        )
        if pip_programs:
            _call_program(
                [
                    conda,
                    "run",
                    "-p",
                    prefix,
                    "python",
                    "-m",
                    "pip",
                    "install",
                    *(f"{p.name}=={p.version}" for p in pip_programs),
                ]
            )

    return impl


@dataclasses.dataclass(frozen=True)
class _EnvSpec:
    name: str
    kind: EnvKind
    creator: Callable[[Path, list[Program]], None]
    python_runner: Callable[[Path], list[str]]
    programs: list[Program]

    base_path: Path | None = None

    @property
    def prefix(self) -> Path:
        if self.base_path is None:
            raise ValueError("Base path has not been set")
        return self.base_path / self.name

    def make_command(self, args: list[str]) -> list[str]:
        return [*self.python_runner(self.prefix), *args]

    def create(self) -> None:
        self.creator(self.prefix, self.programs)


_ENV_SPECS = (
    _EnvSpec(
        name="mamba",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("mamba"),
        python_runner=_conda_runner("mamba"),
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA)],
    ),
    _EnvSpec(
        name="conda",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("conda"),
        python_runner=_conda_runner("conda"),
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA)],
    ),
    _EnvSpec(
        name="mamba_pip",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("mamba"),
        python_runner=_conda_runner("mamba"),
        programs=[
            Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA),
            Program(name="pydantic", version="2.13.4", kind=ProgramKind.PIP),
        ],
    ),
    _EnvSpec(
        name="pip",
        kind=EnvKind.VENV,
        creator=_pip_create_env,
        python_runner=_venv_runner,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.PIP)],
    ),
    _EnvSpec(
        name="uv",
        kind=EnvKind.VENV,
        creator=_uv_create_env,
        python_runner=_venv_runner,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.PIP)],
    ),
    _EnvSpec(
        name="uv_run",
        kind=EnvKind.VENV,
        creator=_uv_create_env,
        python_runner=_uv_runner,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.PIP)],
    ),
    _EnvSpec(
        name="pixi",
        kind=EnvKind.PIXI,
        creator=_pixi_create_env,
        python_runner=_pixi_runner,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA)],
    ),
    _EnvSpec(
        name="pixi_pip",
        kind=EnvKind.PIXI,
        creator=_pixi_create_env,
        python_runner=_pixi_runner,
        programs=[
            Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA),
            Program(name="pydantic", version="2.13.4", kind=ProgramKind.PIP),
        ],
    ),
)


@pytest.fixture(scope="session", params=_ENV_SPECS, ids=lambda spec: spec.name)
def env_spec(
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
    skip_unless_enabled: None,
) -> _EnvSpec:
    # return dataclasses.replace(request.param, base_path=BASE_PATH)
    raw: _EnvSpec = request.param
    prefix = tmp_path_factory.mktemp(raw.name)
    filled_in = dataclasses.replace(raw, base_path=prefix)
    filled_in.create()
    return filled_in


# Test scripts import directly from _environment.py in the source directory.
# This way, the tests do not have to install the package or any dependencies.
def source_working_dir() -> str:
    return os.fspath(
        Path(__file__).resolve().parent.parent.parent / "src" / "scicat_widget"
    )


def test_detect_environment_kind(env_spec: _EnvSpec) -> None:
    py_script = """
from _environment import detect_environment
print(detect_environment())
"""
    try:
        result = subprocess.run(  # noqa: S603
            env_spec.make_command(["-c", py_script]),
            check=True,
            text=True,
            capture_output=True,
            cwd=source_working_dir(),
        )
    except subprocess.CalledProcessError as error:
        _print_captured_output(error)
        raise
    _print_captured_output(result)

    kind = EnvKind(result.stdout.strip())
    assert kind == env_spec.kind


def test_list_programs(env_spec: _EnvSpec) -> None:
    py_script = """
import json
from _environment import list_programs
programs = list_programs()
print(json.dumps([
    {"name": program.name, "version": program.version, "kind": program.kind.value}
    for program in programs
]))
"""
    try:
        result = subprocess.run(  # noqa: S603
            env_spec.make_command(["-c", py_script]),
            check=True,
            text=True,
            capture_output=True,
            cwd=source_working_dir(),
        )
    except subprocess.CalledProcessError as error:
        _print_captured_output(error)
        raise
    _print_captured_output(result)

    parsed = json.loads(result.stdout)
    for program in env_spec.programs:
        program_dict = {
            "name": program.name,
            "version": program.version,
            "kind": program.kind.value,
        }
        assert program_dict in parsed, f"Missing program {program}"


def _print_captured_output(capture: Any) -> None:
    print("~~~ Captured subprocess STDOUT ~~~")  # noqa: T201
    print(capture.stdout)  # noqa: T201
    print("~~~ Captured subprocess STDERR ~~~")  # noqa: T201
    print(capture.stderr)  # noqa: T201
    print("~~~ End of capture ~~~")  # noqa: T201
