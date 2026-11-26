import { InputComponent, InputOptions, UpdateEvent } from "./inputComponent.ts";
import { BackendComm, ResBrowseFiles, ResInspectFile } from "../../comm.ts";
import { TextInput } from "./textInput.ts";
import { iconTextButton } from "../button.ts";
import { humanSize } from "../output.ts";

/**
 * Input component for a file (path).
 */
export class FileInput extends InputComponent<string> {
    private readonly textInput: TextInput;

    private readonly comm: BackendComm;
    private readonly commId: string = crypto.randomUUID();
    private debounceTimer: number | null = null;
    private previousValue: string | null = null;
    private validationResult: string | null = null;

    private inspectionResult_: ResInspectFile | null = null;

    constructor(key: string, comm: BackendComm, options: InputOptions<string>) {
        const textInput = new TextInput(key, options);
        const browseButton = iconTextButton(
            "folder-open",
            "Browse",
            () => {
                comm.sendReqBrowseFiles(this.commId, {});
            },
            "Browse files",
        );
        const container = document.createElement("div");
        container.classList.add("cean-file-input");
        container.append(textInput.container, browseButton);

        super(key, container, options);
        this.textInput = textInput;
        this.comm = comm;
        // Delegate to textInput for validation
        this.isValid = () => this.textInput.isValid();

        textInput.container.addEventListener("input", () => {
            // Clear so we don't show stale results, prevents some flickering.
            this.validationResult = null;
            this.previousValue = null;
            this.textInput.validate();
            this.callDebouncedAfter(() => {
                this.inspectFile();
            }, 500);
        });
        textInput.container.addEventListener("input-updated", ((e: UpdateEvent) => {
            e.stopPropagation(); // Handle text updates internally
        }) as EventListener);

        comm.onResInspectFile(this.commId, (payload) => {
            this.applyInspectionResult(payload);
        });
        comm.onResBrowseFiles(this.commId, (payload) => {
            this.applySelectedFile(payload);
        });

        textInput.customValidator = () => {
            return this.validationResult;
        };
    }

    destroy() {
        this.comm.offResInspectFile(this.commId);
        this.comm.offResBrowseFiles(this.commId);
    }

    get id(): string {
        return this.textInput.id;
    }

    disableEditing() {
        super.disableEditing();
        this.textInput.disableEditing();
        this.container.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
        });
    }

    get value(): string | null {
        if (this.textInput.isValid()) {
            return this.textInput.value;
        } else {
            return null;
        }
    }

    get inspectionResult(): ResInspectFile | null {
        return this.inspectionResult_;
    }

    get size(): number | null {
        if (this.inspectionResult_) {
            return this.inspectionResult_.size ?? null;
        } else {
            return null;
        }
    }

    setSilent(value: string | null) {
        this.textInput.setSilent(value);
        this.inspectFile();
    }

    private inspectFile() {
        const value = this.value;
        if (!value) {
            this.previousValue = null;
            this.validationResult = null;
            this.inspectionResult_ = null;
            this.validationResult = null;
            this.statusElement.replaceChildren();
            this.textInput.validate();
            this.updated();
        } else if (value !== this.previousValue) {
            this.comm.sendReqInspectFile(this.commId, {
                filename: value,
            });
        }
    }

    private applyInspectionResult(result: ResInspectFile) {
        this.validationResult = result.error ?? null;
        this.previousValue = this.value;
        if (result.success) {
            this.inspectionResult_ = result;
            this.validationResult = null;
            renderFileStats(
                this.statusElement,
                result.size ?? 0,
                new Date(result.creationTime ?? ""),
            );
        } else {
            this.inspectionResult_ = null;
            this.validationResult = result.error ?? "unknown error";
            this.statusElement.replaceChildren();
        }
        this.textInput.validate();
        this.updated(true);
        this.container.dispatchEvent(
            new CustomEvent("file-inspected", {
                bubbles: false,
                detail: { payload: result },
            }),
        );
    }

    private applySelectedFile(result: ResBrowseFiles) {
        this.setSilent(result.selected);
    }

    private callDebouncedAfter(fn: () => void, timeout: number) {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            fn();
            this.debounceTimer = null;
        }, timeout);
    }
}

function renderFileStats(
    parent: HTMLElement,
    size: number | null,
    creationTime: Date | null,
) {
    const sizeSpan = humanSize(size);
    // Should not be null, but that depends on the Python code sending the messages
    const dateStr = creationTime !== null ? creationTime.toLocaleString() : "ERROR";
    parent.innerHTML = `<span>Size:</span>${sizeSpan.outerHTML}<span>Creation time:</span><span>${dateStr}</span>`;
}
