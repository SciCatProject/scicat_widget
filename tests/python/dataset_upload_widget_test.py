from typing import Any

from scitacean import Client, Profile
from scitacean.testing.client import FakeClient
from scitacean.testing.transfer import FakeFileTransfer

from scicat_widget import DatasetUploadWidget


def test_can_create_dataset_upload_widget() -> None:
    client = Client.without_login("staging.ess")
    _ = DatasetUploadWidget(client)


def test_build_field_echoes_request_id() -> None:
    def source_folder(proposalIds: list[str]) -> str:
        return f"/data/{proposalIds[0]}"

    profile = Profile(
        url="https://fake.scicat",
        file_transfer=FakeFileTransfer(),
        field_factories={"sourceFolder": source_folder},
    )
    widget = DatasetUploadWidget(FakeClient.without_login(profile))
    sent: list[dict[str, Any]] = []
    widget.send = sent.append

    widget._handle_build_field(
        "key-1",
        {"name": "sourceFolder", "values": {"proposalIds": ["p1"]}, "requestId": 7},
    )
    widget._handle_build_field(
        "key-2", {"name": "unknown", "values": {}, "requestId": 8}
    )

    assert sent[0] == {
        "type": "res:build-field",
        "key": "key-1",
        "payload": {"value": "/data/p1", "requestId": 7},
    }
    assert sent[1]["key"] == "key-2"
    assert sent[1]["payload"]["requestId"] == 8
    assert "error" in sent[1]["payload"]


def test_config_contains_locked_and_non_editable_fields() -> None:
    client = FakeClient.without_login("staging.ess")
    widget = DatasetUploadWidget(
        client,
        locked=["ownerGroup"],
        non_editable=["sourceFolder", "datasetName"],
    )
    assert widget.config["lockedFields"] == ["ownerGroup"]
    assert widget.config["nonEditableFields"] == ["sourceFolder", "datasetName"]
