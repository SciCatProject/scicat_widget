# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

from pathlib import Path

_STATIC_PATH = Path(__file__).parent.parent / "_static"


def js_and_css(name: str) -> tuple[Path, Path]:
    return (
        _STATIC_PATH / f"{name}.js",
        _STATIC_PATH / f"{name}.css",
    )
