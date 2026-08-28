import { File } from "../../models.ts";
import { BackendComm } from "../../comm.ts";
import { removeButton } from "../index.ts";
import { FileInput, InputComponent, TextInput } from "./index.ts";
import { InputOptions } from "./inputComponent.ts";
import { createLabel, createLabelFor, pathOutput } from "../../forms";
import { iconForFileType } from "../icon.ts";

export class MultiFileInput extends InputComponent<File[]> {
    private readonly newFileInput: FileInput;
    private readonly selectedContainer: HTMLDivElement;
    private readonly selectedFiles: FileItem[] = [];

    private filesAreValid: boolean = true;

    constructor(key: string, comm: BackendComm, options: InputOptions<File[]>) {
        const [container, newFileInput, selectedContainer] = createBaseStructure(
            key,
            comm,
        );

        super(key, container, options);
        this.newFileInput = newFileInput;
        this.selectedContainer = selectedContainer;

        this.newFileInput.container.addEventListener("input-updated", (() => {
            const localPath = this.newFileInput.value;
            const data = this.newFileInput.inspectionResult;
            if (localPath === null || data === null) return;
            this.addFileItem({
                localPath,
                remotePath: data.remotePath,
                type: data.type,
                size: data.size,
            });
            this.newFileInput.setSilent(null);
        }) as EventListener);

        this.isValid = () => {
            return this.filesAreValid;
        };
    }

    destroy() {
        this.newFileInput.destroy();
    }

    get value(): File[] {
        return this.selectedFiles
            .map((item) => {
                const localPath = item.localPath.value;
                return {
                    localPath: localPath,
                    remotePath: item.remotePathInput.value ?? undefined,
                };
            })
            .filter((v) => v) as File[];
    }

    get nFiles(): number {
        return this.selectedFiles.length;
    }

    get totalSize(): number {
        return this.selectedFiles.reduce((sum, item) => sum + (item.size ?? 0), 0);
    }

    setSilent(value: File[] | null) {
        // Clear current inputs
        this.selectedFiles.splice(0, this.selectedFiles.length);
        this.selectedContainer.replaceChildren();

        if (value && value.length > 0) {
            for (const file of value) {
                this.addFileItem(file);
            }
        }
    }

    get id(): string {
        return this.newFileInput.id;
    }

    lock() {
        super.lock();
        this.newFileInput.lock();
        this.selectedContainer.classList.add("cean-locked");
        this.selectedFiles.forEach(({ remotePathInput }) => {
            remotePathInput.lock();
        });
    }

    updated(userTriggered: boolean = true) {
        this.validate_files();
        super.updated(userTriggered);
    }

    private addFileItem(file: File) {
        // TODO if file exists -> skip
        const item = new FileItem((p) => {
            this.onInputRemoved(p);
        }, file);

        this.selectedFiles.push(item);
        this.selectedContainer.append(item.container);
        this.updated();
    }

    private onInputRemoved(localPath: HTMLOutputElement) {
        const index = this.selectedFiles.findIndex(
            (item) => item.localPath === localPath,
        );
        if (index !== -1) {
            this.selectedFiles.splice(index, 1);
        }
        this.updated();
    }

    private validate_files(): string | null {
        const byRemotePath = new Map();
        for (const file of this.selectedFiles) {
            const remotePath =
                file.remotePathInput.value ?? file.remotePathInput.placeholder;
            if (byRemotePath.has(remotePath)) {
                byRemotePath.get(remotePath).push(file);
            } else {
                byRemotePath.set(remotePath, [file]);
            }
        }

        for (const files of byRemotePath.values()) {
            files.forEach((file: FileItem) => {
                file.setValidity(files.length > 1 ? "Duplicate file name" : null);
            });
        }

        return "bad file";
    }
}

function createBaseStructure(
    key: string,
    comm: BackendComm,
): [HTMLFieldSetElement, FileInput, HTMLDivElement] {
    const newFileInput = new FileInput(`${key}-newFile`, comm, {});
    const newFileLabel = createLabelFor(newFileInput, "Input new file");

    const selectedLabel = document.createElement("div");
    selectedLabel.textContent = "Selected files:";

    const selectedContainer = document.createElement("div");

    const fieldset = document.createElement("fieldset");
    fieldset.classList.add("cean-multi-file-input");
    fieldset.append(
        newFileLabel,
        newFileInput.container,
        selectedLabel,
        selectedContainer,
    );
    return [fieldset, newFileInput, selectedContainer];
}

class FileItem {
    readonly localPath: HTMLOutputElement;
    readonly remotePathInput: TextInput;
    readonly size: number;

    readonly container: HTMLFieldSetElement;
    private readonly errorOutput: HTMLOutputElement;

    constructor(onInputRemoved: (x: HTMLOutputElement) => void, file: File) {
        const [fieldSet, localPath, remotePathInput, errorOutput] = FileItem.create(
            onInputRemoved,
            file,
        );
        this.localPath = localPath;
        this.remotePathInput = remotePathInput;
        this.size = file.size ?? 0;
        this.container = fieldSet;
        this.errorOutput = errorOutput;
    }

    setValidity(message: string | null) {
        this.errorOutput.textContent = message ?? "";
        if (!message) {
            this.errorOutput.style.display = "none";
        } else {
            this.errorOutput.style.display = "block";
        }
    }

    private static create(
        onInputRemoved: (x: HTMLOutputElement) => void,
        file: File,
    ): [HTMLFieldSetElement, HTMLOutputElement, TextInput, HTMLOutputElement] {
        const fieldset = document.createElement("fieldset");
        fieldset.className = "cean-selected-file-item";

        const localPath = pathOutput(file.localPath);
        const localPathLabel = createLabel(localPath, "localPath");
        localPathLabel.htmlFor = localPath.id;

        const remotePathInput = new TextInput("remotePath", {});
        remotePathInput.placeholder = file.remotePath ?? "";
        const remotePathLabel = createLabelFor(remotePathInput);

        const errorOutput = document.createElement("output");
        errorOutput.classList.add("cean-error");

        const inputContainer = document.createElement("div");
        inputContainer.classList.add("cean-input-grid");
        inputContainer.append(
            localPathLabel,
            localPath,
            remotePathLabel,
            remotePathInput.container,
            errorOutput,
        );

        const button = removeButton(() => {
            fieldset.remove();
            onInputRemoved(localPath);
        });

        const el = document.createElement("i");
        el.classList.add("cean-file-icon");
        iconForFileType(file.type).element({
            container: el,
            width: "2em",
            height: "2em",
        });

        fieldset.append(el, inputContainer, button);
        return [fieldset, localPath, remotePathInput, errorOutput];
    }
}
