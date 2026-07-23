import { InputComponent, InputOptions } from "./inputComponent.ts";

export interface Options extends InputOptions<string> {
    multiline?: boolean;
    type?: "text" | "email" | "password";
    placeholder?: string;
}

/**
 * Input component for text.
 *
 * Can be either `<input type="text"/>` or `<textarea/>`.
 */
export class TextInput extends InputComponent<string> {
    protected readonly inputElement: HTMLInputElement | HTMLTextAreaElement;
    private readonly clearButton: HTMLButtonElement;

    constructor(key: string, options: Options) {
        const inputElement = makeInputElement(options);
        inputElement.id = crypto.randomUUID();
        inputElement.name = key;
        inputElement.required = options.required ?? false;
        inputElement.classList.add("cean-input");

        const [insert, clearButton] = InputComponent.createInsert(inputElement, () => {
            this.setSignaling("");
            inputElement.focus();
        });

        const container = document.createElement("div");
        container.id = crypto.randomUUID();
        container.classList.add("cean-input-container");
        container.append(inputElement, insert);

        super(key, container, options);
        this.inputElement = inputElement;
        this.inputElement.placeholder = options.placeholder ?? "";
        this.clearButton = clearButton as HTMLButtonElement;

        // The trim listener must come before the validation listener,
        // so the validation can detect empty strings after trimming.
        this.inputElement.addEventListener("blur", () => {
            this.inputElement.value = this.inputElement.value.trim();
        });
        this.triggerUpdatesFrom(this.inputElement);
        this.addValidationListener(this.inputElement);
    }

    get value(): string | null {
        const val = this.inputElement.value.trim();
        if (val === "") return null;
        return val;
    }

    setSilent(value: string | null) {
        if (this.locked) return;
        this.inputElement.value = value ?? "";
        this.clearButton.disabled = this.inputElement.value.length === 0;
    }

    updated(userTriggered: boolean = true) {
        this.clearButton.disabled = this.inputElement.value.length === 0;
        super.updated(userTriggered);
    }

    get placeholder(): string {
        return this.inputElement.placeholder;
    }

    set placeholder(v: string | null) {
        this.inputElement.placeholder = v ?? "";
    }

    get id(): string {
        return this.inputElement.id;
    }

    lock() {
        super.lock();
        this.inputElement.disabled = true;
    }

    protected get validationElement(): HTMLElement {
        return this.inputElement;
    }
}

function makeInputElement(options: Options): HTMLInputElement | HTMLTextAreaElement {
    if (options.multiline) {
        const textarea = document.createElement("textarea");
        textarea.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.code === "Enter" || event.code === "NumpadEnter") {
                // Do not propagate to form, use the default to insert a line break.
                event.stopImmediatePropagation();
            }
        });
        return textarea;
    } else {
        const inputElement = document.createElement("input");
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.code === "Enter" || event.code === "NumpadEnter") {
                event.preventDefault();
                event.stopPropagation();
            }
        });
        inputElement.type = options.type ?? "text";
        return inputElement;
    }
}
