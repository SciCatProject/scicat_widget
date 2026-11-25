# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 SciCat Project (https://github.com/SciCatProject/scitacean)
from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any
from uuid import uuid4

import traitlets
from scitacean import Client, Profile, builtin_profile_factories

from ._base_widget import BaseWidget
from ._js import js_and_css


class LoginWidget(BaseWidget):
    _esm, _css = js_and_css("loginWidget")

    instances = traitlets.List[dict[str, object]]().tag(sync=True)

    def __init__(self, profiles: Iterable[Profile] | None = None) -> None:
        profile_dict = _load_profiles(profiles)

        event_handlers: dict[str, Callable[[str, dict[str, Any]], None]] = {
            "req:login": self._handle_on_login,
        }
        super().__init__(
            event_handlers=event_handlers, instances=_serialize_profiles(profile_dict)
        )

        self._profiles = profile_dict
        self._client: Client | None = None
        self._login_callbacks: list[Callable[[Client], None]] = []

    def on_login(self, callback: Callable[[Client], None]) -> None:
        """Register a function to call with the client after a successful login."""
        self._login_callbacks.append(callback)

    def _handle_on_login(self, key: str, payload: dict[str, Any]) -> None:
        if instance_key := payload.get("instance_key"):
            result = self._sso_login(instance_key)
        else:
            result = self._token_login(payload["apiUrl"], payload["token"])
        self.send({"type": "res:login", "key": key, "payload": result})

        if result["success"] and self._client is not None:
            for callback in self._login_callbacks:
                callback(self._client)

    def _sso_login(self, instance_key: str) -> dict[str, str | bool]:
        try:
            profile = self._profiles[instance_key]
        except KeyError:
            return {"success": False, "error": "Internal error: Bad instance key"}

        try:
            self._client = Client.login(profile, open_browser=self._open_in_browser)
        except Exception as error:
            return {"success": False, "error": str(error)}
        return {"success": True}

    def _token_login(self, url: str, token: str) -> dict[str, str | bool]:
        try:
            self._client = Client.from_token(url=url, token=token)
        except Exception as error:
            return {"success": False, "error": str(error)}
        return {"success": True}

    def _open_in_browser(self, url: str) -> _NullClosing:
        # TODO normal vs code
        self.send(
            {
                "type": "req:openBrowser",
                "key": "",
                "payload": {"url": url, "code": "mlz-asd"},
            }
        )
        return _NullClosing()


def _serialize_profiles(profiles: dict[str, Profile]) -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "name": _profile_name(p),
            "apiUrl": p.url,
            "frontendUrl": p.frontend_url or p.url,
            "supportsSSO": bool(p.oauth_clients),
        }
        for key, p in profiles.items()
    ]


def _profile_name(profile: Profile) -> str:
    # Use getattr to support older Scitacean versions
    if name := getattr(profile, "name", ""):
        return name
    url = profile.frontend_url or profile.url
    return url.removeprefix("http://").removeprefix("https://")


# We don't need to close anything here.
# But this is needed by Scitacean.
class _NullClosing:
    def close(self) -> None:
        pass


def _load_profiles(profiles: Iterable[Profile] | None = None) -> dict[str, Profile]:
    p = (
        (f() for f in builtin_profile_factories().values())
        if profiles is None
        else profiles
    )
    return {uuid4().hex: profile for profile in p}
