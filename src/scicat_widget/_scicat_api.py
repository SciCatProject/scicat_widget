# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

from scitacean import Client

# Not great but there is no need to reimplement this here,
# and handling of ORCID iDs is not part of the core functionality of Scitacean.
from scitacean._internal.orcid import parse_orcid_id

from ._model import Instrument, ProposalOverview, UserInfo


def get_user_and_scicat_info(client: Client) -> tuple[UserInfo, list[Instrument]]:
    user_info = get_user_info(client)
    instruments = get_instruments(client)
    return user_info, instruments


def get_user_info(client: Client) -> UserInfo:
    identity = client.scicat.call_endpoint(
        cmd="GET", url="users/my/identity", operation="get_user_info"
    )
    profile = identity["profile"]

    access_groups = sorted(profile.get("accessGroups", []))
    proposals = get_proposals(client, access_groups) if access_groups else []

    return UserInfo(
        user_id=identity["userId"],
        display_name=profile.get("displayName", None),
        email=profile.get("email", None),
        access_groups=access_groups,
        orcid_id=_maybe_parse_orcid_id(
            profile.get("oidcClaims", {}).get("orcid", None)
        ),
        proposals=proposals,
    )


def get_proposals(client: Client, access_groups: list[str]) -> list[ProposalOverview]:
    proposals = client.scicat.call_endpoint(
        cmd="GET", url="proposals", operation="get_proposals"
    )
    # the API call returns all proposals, select only the ones the user has access to:
    # assuming the access groups match proposals (the case at ESS)
    return [
        ProposalOverview(
            id_=p["proposalId"],
            title=p["title"],
            start_time=p["startTime"],
            instrument_ids=p["instrumentIds"],
            pi_name=_combine_pi_name(p),
            pi_email=p.get("pi_email", None),
            type=p.get("type", None),
        )
        for p in proposals
        if p["proposalId"] in access_groups
    ]


def _combine_pi_name(proposal: dict[str, str]) -> str | None:
    match (proposal.get("pi_firstname"), proposal.get("pi_lastname")):
        case (None, None):
            return None
        case (None, name) | (name, None):
            return name
        case (first, last):
            return f"{first} {last}"


def get_instruments(client: Client) -> list[Instrument]:
    return [
        Instrument.from_download_model(instrument)
        for instrument in client.scicat.get_all_instrument_models()
    ]


def _maybe_parse_orcid_id(orcid_id: str | None) -> str | None:
    if orcid_id is None:
        return None
    try:
        return parse_orcid_id(orcid_id)
    except ValueError:
        return None
