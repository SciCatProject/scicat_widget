from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError
from scitacean import PID, Client, Dataset, File, Thumbnail, model


def upload_dataset(
    client: Client, widget_data: dict[str, object]
) -> Dataset | UploadError:
    # TODO check instrument, seem to be NOne
    dataset = make_dataset_from_widget_data(widget_data)
    try:
        return client.upload_new_dataset_now(dataset)
    except ValidationError as error:
        return UploadError(
            field_errors=[
                FieldError(field=str(err["loc"][0]), error=err["msg"])
                for err in error.errors()
            ]
        )
    except ValueError as error:
        if "cannot determine source_folder" in error.args[0].lower():
            return UploadError(
                field_errors=[FieldError(field="sourceFolder", error="Field required")]
            )
        return UploadError(message=",".join(error.args))
    except Exception as error:
        return UploadError(message=",".join(error.args))


class FieldError(BaseModel, extra="forbid"):
    field: str
    error: str


class UploadError(BaseModel, extra="forbid"):
    message: str | None = None
    field_errors: list[FieldError] = Field(
        default_factory=list, serialization_alias="fieldErrors"
    )


def make_dataset_from_widget_data(data: dict[str, Any]) -> Dataset:
    """Construct a Scitacean dataset from widget data."""
    converted = _convert_field_names(data)

    converted["contact_email"] = _concat_list(data.get("contactEmails", None))
    converted.update(_convert_owners(data.get("owners", [])))
    converted.update(_convert_relationships(converted.pop("relationships", None)))
    converted.update(_convert_scientific_metadata(data.get("scientificMetadata", [])))

    files = _convert_files(data.get("files", {}))

    attachments = _convert_attachments(data.get("attachments", {}))

    dataset = Dataset(**converted)
    dataset.add_files(*files)
    for attachment in attachments:
        dataset.add_attachment(
            Thumbnail.parse(attachment["data"]), caption=attachment["caption"]
        )
    return dataset


def _concat_list(values: list[str] | None) -> str | None:
    if values is None:
        return None
    return ";".join(values)


def _convert_owners(owners: list[dict[str, str]] | None) -> dict[str, str]:
    if not owners:
        return {}

    names = [("name", "owner"), ("email", "owner_email"), ("orcid", "orcid_of_owner")]
    return {
        scicat_name: ";".join(collected)
        for short_name, scicat_name in names
        if any(collected := [owner.get(short_name, "") for owner in owners])
    }


def _convert_relationships(
    relationships: list[dict[str, str]] | None,
) -> dict[str, Any]:
    if not relationships:
        return {}

    converted = [
        model.Relationship(
            relationship=rel.get("relationship", ""),
            pid=PID.parse(rel.get("dataset", "")),
        )
        for rel in relationships
        if rel.get("relationship", "") != "input"
    ]
    inputs = [
        PID.parse(rel.get("dataset", ""))
        for rel in relationships
        if rel.get("relationship", "") == "input"
    ]

    result: dict[str, Any] = {}
    if inputs:
        result["input_datasets"] = inputs
    if converted:
        result["relationships"] = converted
    return result


def _convert_scientific_metadata(
    meta: list[dict[str, str]],
) -> dict[str, dict[str, dict[str, str]]]:
    converted = {}
    for field in meta:
        data = {"value": field.get("value", "")}
        if unit := field.get("unit"):
            data["unit"] = unit
        converted[field["name"]] = data
    return {"meta": converted}


def _convert_files(files: list[dict[str, str]]) -> list[File]:
    converted_files = [
        File.from_local(spec["localPath"], remote_path=spec.get("remotePath", None))
        for spec in files
    ]
    return converted_files


def _convert_attachments(
    attachments: list[dict[str, str]],
) -> list[dict[str, Any]]:
    return [
        {"data": attachment["data"], "caption": attachment.get("caption", "")}
        for attachment in attachments
    ]


def _convert_field_names(widget_data: dict[str, Any]) -> dict[str, Any]:
    return {
        field.name: value
        for field in Dataset.fields()
        if (value := widget_data.get(field.scicat_name)) is not None
    }
