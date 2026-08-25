import dataclasses
import json
import os
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scicat_widget._environment import EnvKind, Program, ProgramKind

_TEST_BASH_SCRIPT_TEMPLATE = """
set -euo pipefail
{activation}
cd {working_dir}
python - <<'PY'
{test_script}
PY
"""
_PYTHON_VERSION = "3.14"

# BASE_PATH = Path("/home/jl/Work/cat/scicat_widget/envs")


def _venv_activation_command(prefix: Path) -> str:
    return f"source {os.fspath(prefix / 'bin' / 'activate')}"


def _mamba_activation_command(prefix: Path) -> str:
    return (
        f'eval "$(mamba shell hook --shell bash)"; mamba activate {os.fspath(prefix)}'
    )


def _call_program(args: list[str | Path]):
    try:
        _ = subprocess.run(  # noqa: S603
            args,
            capture_output=True,
            check=True,
            text=True,
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
    _call_program(["uv", "venv", "-p", _PYTHON_VERSION, prefix])
    _call_program(
        [
            "uv",
            "pip",
            "install",
            "-p",
            _PYTHON_VERSION,
            "--prefix",
            prefix,
            *(f"{p.name}=={p.version}" for p in programs),
        ]
    )


def _conda_create_env(conda: str) -> Callable[[Path, list[Program]], None]:
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
    activator: Callable[[Path], str]
    programs: list[Program]

    base_path: Path | None = None

    @property
    def prefix(self) -> Path:
        if self.base_path is None:
            raise ValueError("Base path has not been set")
        return self.base_path / self.name

    @property
    def activation_command(self) -> str:
        return self.activator(self.prefix)

    def create(self) -> None:
        self.creator(self.prefix, self.programs)


_ENV_SPECS = (
    _EnvSpec(
        name="mamba",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("mamba"),
        activator=_mamba_activation_command,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA)],
    ),
    _EnvSpec(
        name="conda",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("conda"),
        activator=_mamba_activation_command,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA)],
    ),
    _EnvSpec(
        name="mamba_pip",
        kind=EnvKind.CONDA,
        creator=_conda_create_env("mamba"),
        activator=_mamba_activation_command,
        programs=[
            Program(name="urllib3", version="2.7.0", kind=ProgramKind.CONDA),
            Program(name="pydantic", version="2.13.4", kind=ProgramKind.PIP),
        ],
    ),
    _EnvSpec(
        name="pip",
        kind=EnvKind.VENV,
        creator=_pip_create_env,
        activator=_venv_activation_command,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.PIP)],
    ),
    _EnvSpec(
        name="uv",
        kind=EnvKind.VENV,
        creator=_uv_create_env,
        activator=_venv_activation_command,
        programs=[Program(name="urllib3", version="2.7.0", kind=ProgramKind.PIP)],
    ),
    # TODO pixi run and uv run
    #   they are different because they don't activate an env in the same shell
)


@pytest.fixture(scope="session", params=_ENV_SPECS, ids=lambda spec: spec.name)
def env_spec(
    request: pytest.FixtureRequest, tmp_path_factory: pytest.TempPathFactory
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
    script = _TEST_BASH_SCRIPT_TEMPLATE.format(
        activation=env_spec.activation_command,
        working_dir=source_working_dir(),
        test_script=py_script,
    )
    try:
        result = subprocess.run(  # noqa: S603
            ["bash", "-c", script],  # noqa: S607
            check=True,
            text=True,
            capture_output=True,
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
    script = _TEST_BASH_SCRIPT_TEMPLATE.format(
        activation=env_spec.activation_command,
        working_dir=source_working_dir(),
        test_script=py_script,
    )
    try:
        result = subprocess.run(  # noqa: S603
            ["bash", "-c", script],  # noqa: S607
            check=True,
            text=True,
            capture_output=True,
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
