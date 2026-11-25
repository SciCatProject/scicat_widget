"""Jupyter widget for uploading datasets to SciCat."""

import importlib.metadata

from ._widgets._dataset_upload_widget import DatasetUploadWidget
from ._widgets._login_widget import LoginWidget
from ._widgets._scicat_widget import SciCatWidget

try:
    __version__ = importlib.metadata.version("scicat_widget")
except importlib.metadata.PackageNotFoundError:
    __version__ = "0.0.0"

__all__ = ["DatasetUploadWidget", "LoginWidget", "SciCatWidget"]
