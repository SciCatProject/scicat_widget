# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--env-tests",
        action="store_true",
        default=False,
        help="Run environment tests.",
    )
