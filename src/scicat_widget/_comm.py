# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

from __future__ import annotations

import inspect
import os
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import quote_plus, urljoin

import IPython.display
from jupyter_host_file_picker import HostFilePicker
from scitacean import Dataset, Thumbnail

from ._filesystem import deduce_file_type, inspect_file
from ._logging import get_logger
from ._upload import UploadError, upload_dataset

if TYPE_CHECKING:
    from ._widgets import DatasetUploadWidget


def _inspect_file(
    widget: DatasetUploadWidget, key: str, input_payload: dict[str, str]
) -> None:
    payload = inspect_file(Path(input_payload["filename"])) or {
        "success": False,
        "error": "File not found",
        **input_payload,
    }
    widget.send(
        {
            "type": "res:inspect-file",
            "key": key,
            "payload": {
                # Echo the input to identify the element that the request came from.
                **input_payload,
                **payload,
            },
        }
    )


def _browse_files(
    widget: DatasetUploadWidget, key: str, _input_payload: dict[str, str]
) -> None:
    def send_selected_files(change: dict[str, Any]) -> None:
        selected: list[Path] = change["new"]
        # TODO handle multi select once supported by file picker
        if len(change) > 0:
            widget.send(
                {
                    "type": "res:browse-files",
                    "key": key,
                    "payload": {
                        "selected": os.fspath(selected[0]),
                    },
                }
            )

    # Use the output widget's context manager to capture the display call
    with widget._aux_output_widget:
        widget._aux_output_widget.clear_output()  # clear previous picker if any
        picker = HostFilePicker()
        picker.observe(send_selected_files, names="selected")
        IPython.display.display(picker)  # type: ignore[no-untyped-call]


def _call_field_factory(factory: Callable[..., Any], args: dict[str, Any]) -> Any:
    spec = inspect.getfullargspec(factory)
    pos_args = [args[name] for name in spec.args]
    kw_args = {name: args[name] for name in spec.kwonlyargs}
    return factory(*pos_args, **kw_args)


def _build_field(
    widget: DatasetUploadWidget, key: str, input_payload: dict[str, Any]
) -> None:
    try:
        factory = widget.client.profile.field_factories[input_payload["name"]]
    except KeyError:
        payload = {"error": f"No factory for field {input_payload['name']}"}
    else:
        payload = {"value": _call_field_factory(factory, input_payload["values"])}

    widget.send(
        {
            "type": "res:build-field",
            "key": key,
            "payload": payload,
        }
    )


def _load_attachment(
    widget: DatasetUploadWidget, key: str, input_payload: dict[str, str]
) -> None:
    path = Path(input_payload.get("path", ""))
    try:
        thumbnail = Thumbnail.load_file(path)
    except FileNotFoundError:
        payload = {"error": "File not found"}
    else:
        payload = {
            "data": thumbnail.serialize(),
            "type": deduce_file_type(path),
            "caption": input_payload.get("caption", path.stem),
        }

    widget.send(
        {
            "type": "res:load-attachment",
            "key": key,
            # Echo the input to identify the element that the request came from.
            "payload": {**input_payload, **payload},
        }
    )


def _upload_dataset(
    widget: DatasetUploadWidget, key: str, payload: dict[str, object]
) -> None:
    match upload_dataset(widget.client, payload):
        case Dataset() as ds:
            widget.send(
                {
                    "type": "res:upload-dataset",
                    "key": key,
                    "payload": {
                        "datasetName": ds.name,
                        "pid": str(ds.pid),
                        "datasetUrl": urljoin(
                            widget.config["frontendUrl"],
                            "datasets/" + quote_plus(str(ds.pid)),
                        ),
                    },
                }
            )
        case UploadError() as error:
            widget.send(
                {
                    "type": "res:upload-dataset",
                    "key": key,
                    "payload": {"error": error.model_dump(by_alias=True)},
                }
            )


_EVENT_HANDLERS = {
    "req:browse-files": _browse_files,
    "req:build-field": _build_field,
    "req:inspect-file": _inspect_file,
    "req:load-attachment": _load_attachment,
    "req:upload-dataset": _upload_dataset,
}


def handle_event(
    widget: DatasetUploadWidget, content: dict[str, Any], buffer: object
) -> None:
    try:
        handler = _EVENT_HANDLERS[content["type"]]
    except KeyError:
        get_logger().warning("Received unknown event from widget: %s", content)
        return
    handler(widget, content["key"], content["payload"])  # type: ignore[operator]
