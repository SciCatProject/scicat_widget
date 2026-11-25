# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

import IPython.display
import ipywidgets
from anywidget import AnyWidget
from jupyter_host_file_picker import HostFilePicker
from scitacean import Thumbnail

from .._filesystem import deduce_file_type, inspect_file
from .._logging import get_logger


class BaseWidget(AnyWidget):
    """Base class for widgets.

    Never instantiate this class on its own, it does not define any JavaScript.
    """

    def __init__(
        self,
        event_handlers: dict[str, Callable[[str, dict[str, Any]], None]],
        **kwargs: object,
    ) -> None:
        super().__init__(**kwargs)

        # This `Output` is displayed alongside `self` so that sub widgets,
        # e.g., a file picker can be attached to it and displayed.
        # We need this because we cannot display widgets in callbacks
        # as those don't have a display context.
        self._aux_output_widget = ipywidgets.Output()
        self._aux_output_widget.add_class("cean-output-anchor")
        self._is_displaying = False

        self._event_handlers = {
            **event_handlers,
            "req:browse-files": self._handle_browse_files,
            "req:inspect-file": self._handle_inspect_file,
            "req:load-attachment": self._handle_load_attachment,
        }
        self.on_msg(self._handle_event)

    def _repr_mimebundle_(
        self, **kwargs: Any
    ) -> tuple[dict[Any, Any], dict[Any, Any]] | None:
        # This is a bit hacky, but it allows us to display this DatasetUploadWidget like
        # normal while also placing the aux output widget next to it.
        if self._is_displaying:
            return super()._repr_mimebundle_(**kwargs)
        self._is_displaying = True
        try:
            return ipywidgets.VBox([self, self._aux_output_widget])._repr_mimebundle_(  # type: ignore[no-any-return]
                **kwargs
            )
        finally:
            self._is_displaying = False

    def _handle_event(
        self, _widget: AnyWidget, content: dict[str, Any], _buffer: object
    ) -> None:
        try:
            handler = self._event_handlers[content["type"]]
        except KeyError:
            get_logger().warning(
                "LoginWidget received unknown event from JS: %s", content
            )
            return
        handler(content["key"], content["payload"])

    def _handle_inspect_file(self, key: str, input_payload: dict[str, str]) -> None:
        payload = inspect_file(Path(input_payload["filename"])) or {
            "success": False,
            "error": "File not found",
            **input_payload,
        }
        self.send(
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

    def _handle_browse_files(self, key: str, _input_payload: dict[str, str]) -> None:
        def send_selected_files(change: dict[str, Any]) -> None:
            selected: list[Path] = change["new"]
            # TODO handle multi select once supported by file picker
            if len(change) > 0:
                self.send(
                    {
                        "type": "res:browse-files",
                        "key": key,
                        "payload": {
                            "selected": os.fspath(selected[0]),
                        },
                    }
                )

        # Use the output widget's context manager to capture the display call
        with self._aux_output_widget:
            self._aux_output_widget.clear_output()  # clear previous picker if any
            picker = HostFilePicker()
            picker.observe(send_selected_files, names="selected")
            IPython.display.display(picker)  # type: ignore[no-untyped-call]

    def _handle_load_attachment(self, key: str, input_payload: dict[str, str]) -> None:
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

        self.send(
            {
                "type": "res:load-attachment",
                "key": key,
                # Echo the input to identify the element that the request came from.
                "payload": {**input_payload, **payload},
            }
        )
