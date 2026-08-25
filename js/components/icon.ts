import {
    fileIcon,
    folderIcon,
    html5Icon,
    imageIcon,
    jsonIcon,
    LabIcon,
    markdownIcon,
    notebookIcon,
    pdfIcon,
    pythonIcon,
    spreadsheetIcon,
    videoIcon,
    yamlIcon,
} from "@jupyterlab/ui-components";
import hdfSvg from "../assets/img/hdf.svg";

const hdfIcon = new LabIcon({ name: "cean:hdf", svgstr: hdfSvg });

export type FileType =
    | "folder"
    | "hdf"
    | "html"
    | "image"
    | "ipynb"
    | "json"
    | "markdown"
    | "pdf"
    | "python"
    | "spreadsheet"
    | "video"
    | "yaml"
    | "file";

export function iconForFileType(fileType: FileType): LabIcon {
    switch (fileType) {
        case "folder":
            return folderIcon;
        case "hdf":
            return hdfIcon;
        case "html":
            return html5Icon;
        case "image":
            return imageIcon;
        case "ipynb":
            return notebookIcon;
        case "json":
            return jsonIcon;
        case "markdown":
            return markdownIcon;
        case "pdf":
            return pdfIcon;
        case "python":
            return pythonIcon;
        case "spreadsheet":
            return spreadsheetIcon;
        case "video":
            return videoIcon;
        case "yaml":
            return yamlIcon;
        default:
            return fileIcon;
    }
}
const FA_ICONS = [
    "chevron-left",
    "chevron-down",
    "external-link-alt",
    "folder-open",
    "pen",
    "plus",
    "sign-in-alt",
    "times-circle",
    "trash",
];

const CUSTOM_ICONS: Record<string, string> = {};

export function createIcon(icon: string): HTMLElement {
    const iconElement = document.createElement("i");
    if (FA_ICONS.includes(icon)) {
        iconElement.className = `fa fa-${icon}`;
    } else {
        iconElement.innerHTML = CUSTOM_ICONS[icon];
    }
    return iconElement;
}
