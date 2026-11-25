# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

import inspect
from collections.abc import Callable, Iterable
from typing import Any
from urllib.parse import quote_plus, urljoin

import traitlets
from scitacean import Client, Dataset, ScicatCommError

from .._logging import get_logger
from .._model import Config, Instrument, ProposalOverview
from .._scicat_api import get_user_and_scicat_info
from .._serialization import (
    load_and_serialize_techniques,
    serialize_dataset,
    serialize_instrument,
    serialize_proposal,
)
from .._upload import UploadError, upload_dataset
from ._base_widget import BaseWidget
from ._js import js_and_css


class DatasetUploadWidget(BaseWidget):
    _esm, _css = js_and_css("datasetUploadWidget")

    config = traitlets.Dict().tag(sync=True)
    initial = traitlets.Dict().tag(sync=True)
    staticData = traitlets.Dict().tag(sync=True)

    def __init__(
        self,
        client: Client,
        *,
        initial: Dataset | None = None,
        locked: Iterable[str] = (),
        skip_confirm: bool = False,
    ) -> None:
        config = _build_config(client, locked=locked, skip_confirm=skip_confirm)
        initial_data, static = _collect_initial_data(client, initial)

        event_handlers = {
            "req:build-field": self._handle_build_field,
            "req:upload-dataset": self._handle_upload_dataset,
        }
        super().__init__(
            config=config.model_dump(),
            initial=initial_data,
            staticData=static,
            event_handlers=event_handlers,
        )
        self.client = client

    def _handle_build_field(self, key: str, input_payload: dict[str, Any]) -> None:
        try:
            factory = self.client.profile.field_factories[input_payload["name"]]
        except KeyError:
            payload = {"error": f"No factory for field {input_payload['name']}"}
        else:
            payload = {"value": _call_field_factory(factory, input_payload["values"])}

        self.send(
            {
                "type": "res:build-field",
                "key": key,
                "payload": payload,
            }
        )

    def _handle_upload_dataset(self, key: str, payload: dict[str, object]) -> None:
        match upload_dataset(self.client, payload):
            case Dataset() as ds:
                self.send(
                    {
                        "type": "res:upload-dataset",
                        "key": key,
                        "payload": {
                            "datasetName": ds.name,
                            "pid": str(ds.pid),
                            "datasetUrl": urljoin(
                                self.config["frontendUrl"],
                                "datasets/" + quote_plus(str(ds.pid)),
                            ),
                        },
                    }
                )
            case UploadError() as error:
                self.send(
                    {
                        "type": "res:upload-dataset",
                        "key": key,
                        "payload": {"error": error.model_dump(by_alias=True)},
                    }
                )


def _build_config(
    client: Client,
    *,
    locked: Iterable[str],
    skip_confirm: bool,
) -> Config:
    profile = client.profile
    return Config(
        frontendUrl=profile.frontend_url,
        scientificMetadataSchema=profile.scientific_metadata_schema,
        fieldDependencies={
            name: _extract_factory_dependencies(fn)
            for name, fn in profile.field_factories.items()
        },
        lockedFields=list(locked),
        skipConfirmation=skip_confirm,
    )


def _extract_factory_dependencies(factory: Callable[..., object]) -> list[str]:
    spec = inspect.getfullargspec(factory)
    if spec.varargs is not None or spec.varkw is not None:
        raise TypeError("Variable arguments are not supported")
    return [*spec.args, *spec.kwonlyargs]


def _collect_initial_data(
    client: Client | None = None, initial: Dataset | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    if client is None:
        return {}, {}
    initial_data, instruments, proposals, access_groups = _download_scicat_data(client)

    static_data = {
        "instruments": [serialize_instrument(instrument) for instrument in instruments],
        "proposals": [serialize_proposal(proposal) for proposal in proposals],
        "accessGroups": access_groups,
        "techniques": load_and_serialize_techniques(),
    }

    if initial is not None:
        initial_data.update(serialize_dataset(initial))

    return initial_data, static_data


def _download_scicat_data(
    client: Client,
) -> tuple[dict[str, Any], list[Instrument], list[ProposalOverview], list[str]]:
    try:
        user_info, instruments = get_user_and_scicat_info(client)
    except (ScicatCommError, ValueError, TypeError, RuntimeError) as error:
        get_logger().warning("Failed to download initial data for user: %s", error)
        return {}, [], [], []

    proposals = user_info.proposals
    access_groups = user_info.access_groups

    initial_data = {
        "owners": [
            {
                "name": user_info.display_name,
                "email": user_info.email,
                "orcid": user_info.orcid_id,
            },
        ],
    }
    return initial_data, instruments, proposals, access_groups


def _call_field_factory(factory: Callable[..., Any], args: dict[str, Any]) -> Any:
    spec = inspect.getfullargspec(factory)
    pos_args = [args[name] for name in spec.args]
    kw_args = {name: args[name] for name in spec.kwonlyargs}
    return factory(*pos_args, **kw_args)
