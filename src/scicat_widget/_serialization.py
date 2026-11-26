# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

"""Serialization of datastructures from Python to JavaScript."""

import os
import warnings
from datetime import datetime
from typing import Any

from scitacean import Attachment, Dataset, File
from scitacean.ontology import expands_techniques

from ._filesystem import inspect_file
from ._model import Instrument, ProposalOverview


def serialize_instrument(instrument: Instrument) -> dict[str, Any]:
    """Serialize a Scitacean instrument model to a dict for the JavaScript widget."""
    return {
        "id": instrument.pid,
        "name": instrument.name,
        "uniqueName": instrument.unique_name,
    }


def serialize_proposal(proposal: ProposalOverview) -> dict[str, Any]:
    """Serialize a proposal overview to a dict for the JavaScript widget."""
    return {
        "id": proposal.id_,
        "title": proposal.title,
        "startTime": proposal.start_time,
        "instrumentIds": proposal.instrument_ids,
        "piName": proposal.pi_name,
        "piEmail": proposal.pi_email,
        "type": proposal.type,
    }


def load_and_serialize_techniques() -> dict[str, Any]:
    """Load the ExPaNDS techniques and serialize them for the JavaScript widget."""
    prefix = next(iter(expands_techniques().keys())).rsplit("/", 1)[0]
    return {
        "prefix": prefix,
        "techniques": [
            {"id": id_.rsplit("/", 1)[-1], "name": names[0]}
            for (id_, names) in expands_techniques().items()
        ],
    }


def serialize_dataset(dataset: Dataset) -> dict[str, Any]:
    """Serialize a Scitacean dataset to a dict for the JavaScript widget."""
    # Drop unset fields, including empty lists (e.g., the default for
    # `principal_investigators`). The widget treats initial values as user input,
    # which would otherwise disable automatic updates of those fields.
    set = {
        key: val
        for key, val in dataset.make_upload_fields().items()
        if val is not None and val not in ("", [])
    }
    if "techniques" in set:
        set["techniques"] = [t.pid.rsplit("/", 1)[-1] for t in set["techniques"]]
    if "sourceFolder" in set:
        set["sourceFolder"] = set["sourceFolder"].posix
    if "contactEmail" in set:
        mails = set.pop("contactEmail").split(";")
        set["contactEmails"] = [] if len(mails) == 1 and not mails[0] else mails
    if "inputDatasets" in set:
        set["inputDatasets"] = [str(pid) for pid in set["inputDatasets"]]

    set = _listify_owners(set)

    set["files"] = [
        set_file
        for file in dataset.files
        if (set_file := _serialize_file(file)) is not None
    ]

    set["attachments"] = [
        set_att
        for attachment in dataset.attachments or []
        if (set_att := _serialize_attachment(attachment)) is not None
    ]
    return set


def _serialize_file(file: File) -> dict[str, str | int | datetime] | None:
    if file.local_path is None:
        return None
    for name in ("remote_gid", "remote_perm", "remote_uid"):
        if value := getattr(file, name):
            warnings.warn(
                f"file.{name} will be dropped in upload; input has value '{value}'",
                UserWarning,
                stacklevel=2,
            )
    result = inspect_file(file.local_path)
    if not result:
        return None
    result.pop("success", None)
    return {
        **result,
        "localPath": os.fspath(file.local_path),
        "remotePath": file.remote_path.posix,
    }


def _serialize_attachment(attachment: Attachment) -> dict[str, str] | None:
    if (thumbnail := attachment.thumbnail) is None:
        return None
    return {"data": thumbnail.serialize(), "caption": attachment.caption}


def _listify_owners(data: dict[str, Any]) -> dict[str, Any]:
    data = dict(data)

    names = _split_list_string(data.pop("owner", ""))
    emails = _split_list_string(data.pop("ownerEmail", ""))
    orcids = _split_list_string(data.pop("orcidOfOwner", ""))

    if not names and not emails and not orcids:
        return data

    lengths = {l for l in (len(names), len(emails), len(orcids)) if l > 0}
    if len(lengths) != 1:
        raise ValueError(
            "Need an equal number of entries in 'owner', 'owner_email', and "
            f"'orcid_of_owner'. Got {len(names)}, {len(emails)}, and {len(orcids)}"
        )
    n = next(iter(lengths))
    names = names or [""] * n
    emails = emails or [""] * n
    orcids = orcids or [""] * n

    data["owners"] = [
        {"name": name or None, "email": email or None, "orcid": orcid or None}
        for name, email, orcid in zip(names, emails, orcids, strict=False)
    ]

    return data


def _split_list_string(string: str) -> list[str]:
    string = string.strip()
    if not string:
        return []  # the code below would return [''] in this case
    # Keep empty strings to get a proper number of elements.
    return [s.strip() for s in string.split(";")]
