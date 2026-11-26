# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)

from collections.abc import Iterable

import ipywidgets
from scitacean import Client, Dataset, Profile

from ._base_widget import BaseWidget
from ._dataset_upload_widget import DatasetUploadWidget
from ._login_widget import LoginWidget


class SciCatWidget(ipywidgets.VBox):  # type: ignore[misc]
    def __init__(
        self,
        client: Client | None = None,
        *,
        profiles: Iterable[Profile] | None = None,
        initial: Dataset | None = None,
        locked: Iterable[str] = (),
        non_editable: Iterable[str] = (),
        skip_confirm: bool = False,
    ) -> None:
        upload_widget_args = {
            "initial": initial,
            "locked": list(locked),  # Might get used multiple times => make list
            "non_editable": list(non_editable),
            "skip_confirm": skip_confirm,
        }
        if client is None:
            underlying = LoginWidget(profiles)
            underlying.on_login(self._on_login)
        else:
            underlying = DatasetUploadWidget(client, **upload_widget_args)  # type: ignore[arg-type]
        super().__init__(children=_children_of(underlying))
        self._underlying: LoginWidget | DatasetUploadWidget = underlying
        self._upload_widget_args = upload_widget_args

    def _on_login(self, client: Client) -> None:
        old = self._underlying
        upload_widget = DatasetUploadWidget(client, **self._upload_widget_args)  # type: ignore[arg-type]
        self._underlying = upload_widget
        # TODO loading message
        self.children = _children_of(upload_widget)
        old.close()


def _children_of(widget: BaseWidget) -> tuple[ipywidgets.Widget, ...]:
    # When a BaseWidget is a child of a container, its custom _repr_mimebundle_
    # is skipped, so its aux output (used by the file picker) must be added explicitly.
    return (widget, widget._aux_output_widget)
