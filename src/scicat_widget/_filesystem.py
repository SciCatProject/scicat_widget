import mimetypes
from datetime import datetime
from pathlib import Path

from scitacean import File


def inspect_file(path: Path) -> dict[str, str | int | bool | datetime] | None:
    """Return a dict describing a file, or None if the file does not exist."""
    try:
        # TODO do not allow folders (probably in scitacean)
        file = File.from_local(path)
    except FileNotFoundError:
        return None
    return {
        "success": True,
        "size": file.size,
        "creationTime": file.creation_time,
        "remotePath": file.remote_path.posix,
        "type": deduce_file_type(path),
    }


_KNOWN_MIMETYPES = {
    "application/json": "json",
    "application/pdf": "pdf",
    "text/markdown": "markdown",
    "text/csv": "spreadsheet",
    "text/html": "html",
    "text/tab-separated-values": "spreadsheet",
    "text/x-python": "python",
}


def deduce_file_type(path: Path) -> str:
    """Deduce the file type from the mimetype and extension.

    The returned type string matches the types recognized by the TypeScript code.
    """
    if path.is_dir():
        return "folder"

    mimetype = mimetypes.guess_type(path)[0]
    try:
        return _KNOWN_MIMETYPES[mimetype]  # type: ignore[index]
    except KeyError:
        pass
    if mimetype is not None:
        if mimetype.startswith("image/"):
            return "image"
        if mimetype.startswith("video/"):
            return "video"

    # Files without a mimetype known to Python:
    match path.suffix.lower():
        case ".ipynb":
            return "ipynb"
        case ".yaml" | ".yml":
            return "yaml"
        case ".pyi":
            return "python"
        case ".hdf" | ".hdf5" | ".h5" | ".nxs":
            return "hdf"

    return "file"
