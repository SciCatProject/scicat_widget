# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)
"""SciCat login functionality."""

from __future__ import annotations

from pydantic import BaseModel
from scitacean import Client


def login(data: dict[str, str]) -> Client | LoginError: ...


class LoginError(BaseModel, extra="forbid"):
    message: str | None = None
