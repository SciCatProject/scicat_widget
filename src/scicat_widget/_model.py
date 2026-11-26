# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

from datetime import datetime

from pydantic import BaseModel, EmailStr
from scitacean import ScientificMetadataSchema
from scitacean.model import Instrument


class Config(BaseModel):
    frontendUrl: str | None
    scientificMetadataSchema: ScientificMetadataSchema
    fieldDependencies: dict[str, list[str]]
    lockedFields: list[str]
    nonEditableFields: list[str]
    skipConfirmation: bool


class ProposalOverview(BaseModel):
    id_: str
    title: str
    start_time: datetime
    instrument_ids: list[str]
    pi_name: str | None
    pi_email: EmailStr | None
    type: str | None


class UserInfo(BaseModel):
    user_id: str
    display_name: str | None
    email: EmailStr | None
    access_groups: list[str]
    orcid_id: str | None
    # The proposals we know the user is a member of, they may have access to more:
    proposals: list[ProposalOverview]


__all__ = ["Config", "Instrument", "ProposalOverview", "UserInfo"]
