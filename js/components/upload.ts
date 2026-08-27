import { BackendComm, ResUploadDataset, UploadError } from "../comm";
import { simpleLink, textElement } from "./output.ts";
import { textButton } from "./button.ts";
import { Dialog } from "./dialog.ts";
import { Config } from "../models.ts";

export class UploadComponent {
    private readonly comm: BackendComm;
    private readonly frontendUrl: string | null;
    private readonly skipConfirmation: boolean;
    private readonly gatherData: () => GatherResult;

    private readonly key = crypto.randomUUID();
    private dialog: Dialog;

    constructor(comm: BackendComm, config: Config, gatherData: () => GatherResult) {
        this.comm = comm;
        this.frontendUrl = config.frontendUrl;
        this.skipConfirmation = config.skipConfirmation;
        this.gatherData = gatherData;

        this.dialog = new Dialog();
        this.comm.onResUploadDataset(this.key, (payload) => {
            this.onUploadResult(payload);
        });
    }

    createButton() {
        const button = document.createElement("button");
        button.type = "submit";
        button.textContent = "Upload dataset";
        button.classList.add("cean-button", "jupyter-button");
        button.addEventListener("click", () => {
            this.askDoUpload();
        });
        return button;
    }

    private askDoUpload() {
        const gathered = this.gatherData();
        if (gathered.validationErrors || !this.skipConfirmation) {
            this.showConfirmationDialog(gathered.data, gathered.validationErrors);
        } else {
            this.showProcessingDialog(gathered.data);
        }
    }

    private startUpload(data: Record<string, any>) {
        this.comm.sendReqUploadDataset(this.key, data);
    }

    private onUploadResult(payload: ResUploadDataset) {
        if (payload.error !== undefined) {
            this.showErrorDialog(payload.error);
        } else {
            this.showSuccessDialog(
                payload.datasetName,
                payload.pid ?? "UNKNOWN",
                payload.datasetUrl ?? "UNKNOWN",
            );
        }
    }

    private showConfirmationDialog(
        data: Record<string, any>,
        validationErrors: boolean,
    ) {
        this.dialog.closeOnClickOutside = true;
        this.dialog.header.textContent = "Confirm Upload";

        let link = this.frontendUrl ? simpleLink(this.frontendUrl) : "SciCat";
        let content = `<p>Are you sure you want to upload this dataset to
${link}?</p>
<p class="cean-warning" style="text-align: center;">This cannot be undone!</p>
    `;
        if (validationErrors) {
            content += `<p class="cean-warning-severe" style="text-align: center;">There are validation errors. The upload may fail.</p>`;
        }
        this.dialog.body.innerHTML = content;

        const cancelButton = textButton(
            "Cancel",
            () => {
                this.dialog.close();
            },
            "Cancel upload",
        );
        cancelButton.classList.add("jupyter-button");

        const uploadButton = textButton(
            "Upload",
            () => {
                this.showProcessingDialog(data);
            },
            "Upload dataset",
        );
        uploadButton.setAttribute("autofocus", "");
        // Override default cean-button
        uploadButton.className = "cean-upload-button jupyter-button";

        this.dialog.footer.replaceChildren(cancelButton, uploadButton);

        this.dialog.showModal();
    }

    private showProcessingDialog(data: Record<string, any>) {
        this.startUpload(data);

        this.dialog.closeOnClickOutside = false;
        this.dialog.header.textContent = "Uploading dataset";
        this.dialog.body.innerHTML =
            '<p style="text-align: center;">Please wait...</p>' +
            '<div style="display: flex; justify-content: center;">' +
            '<span class="cean-spinner"></span>' +
            "</div>";

        const abortButton = textButton(
            "Abort",
            () => {
                // TODO actually abort upload, possible?
                this.dialog.close();
            },
            "Abort upload",
        );
        abortButton.classList.add("jupyter-button");
        this.dialog.footer.replaceChildren(abortButton);
    }

    private showErrorDialog(error: UploadError) {
        this.dialog.closeOnClickOutside = true;
        this.dialog.header.textContent = "Error";

        const report = document.createElement("div");

        const intro = document.createElement("p");
        intro.textContent = "There were errors during the upload:";
        report.append(intro);

        if (error.message !== undefined) {
            const message = document.createElement("p");
            message.className = "cean-error";
            message.textContent = error.message;
            report.append(message);
        }

        if (error.fieldErrors.length > 0) {
            const fieldList = document.createElement("ul");
            fieldList.classList.add("cean-validation-error-list");
            for (const err of error.fieldErrors) {
                const name = document.createElement("strong");
                name.textContent = err.field;
                const message = document.createElement("span");
                message.textContent = err.error;
                const item = document.createElement("li");
                item.append(name, message);
                fieldList.appendChild(item);
            }
            report.append(fieldList);
        }

        const detail = document.createElement("p");
        detail.textContent =
            "The dataset was not uploaded. Please fix the listed fields and try again.";
        report.append(detail);

        this.dialog.body.replaceChildren(report);

        const closeButton = textButton(
            "Close",
            () => {
                this.dialog.close();
            },
            "Close dialog",
        );
        closeButton.setAttribute("autofocus", "");
        closeButton.classList.add("jupyter-button");
        this.dialog.footer.replaceChildren(closeButton);
    }

    private showSuccessDialog(datasetName: string, pid: string, datasetUrl: string) {
        this.dialog.closeOnClickOutside = true;
        this.dialog.header.textContent = "Success";

        const a = textElement("p", "Dataset");
        const name = textElement("p", `"${datasetName}"`);
        name.style.fontWeight = "bold";
        name.style.textAlign = "center";
        const b = textElement("p", "with ID");
        const idDiv = document.createElement("div");
        idDiv.style.display = "flex";
        idDiv.style.justifyContent = "center";
        idDiv.style.color = "var(--jp-success-color2)";
        idDiv.append(textElement("code", pid));
        const c = textElement("p", "was uploaded successfully. You can find it at");
        const link = document.createElement("div");
        link.style.display = "flex";
        link.style.textAlign = "center";
        link.innerHTML = simpleLink(datasetUrl);
        this.dialog.body.replaceChildren(a, name, b, idDiv, c, link);

        const closeButton = textButton(
            "Close",
            () => {
                this.dialog.close();
            },
            "Close dialog",
        );
        closeButton.setAttribute("autofocus", "");
        closeButton.classList.add("jupyter-button");
        this.dialog.footer.replaceChildren(closeButton);
    }
}

export type GatherResult = {
    validationErrors: boolean;
    data: Record<string, any>;
};
