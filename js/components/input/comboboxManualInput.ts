import { InputComponent, UpdateEvent } from "./inputComponent.ts";
import { TextInput } from "./textInput.ts";
import { toggleButton } from "../button.ts";
import { Choice, ComboboxInput, Options as ComboboxOptions } from "./comboboxInput.ts";

export interface Options extends ComboboxOptions {
    fieldName: string;
}

/**
 * Input component with a combobox or a manual-entry text input.
 */
export class ComboboxManualInput extends InputComponent<string> {
    private readonly comboboxInput: ComboboxInput;
    private readonly textInput: TextInput;
    private readonly id_ = crypto.randomUUID();

    constructor(key: string, choices: Choice[], options: Options) {
        const comboboxInput = new ComboboxInput(`${key}-combobox`, choices, options);
        const textInput = new TextInput(`${key}-text`, {});
        const manualButton = toggleButton(
            "pen",
            "Manual",
            (e) => {
                if ((e.target as HTMLInputElement).checked) {
                    this.setManual();
                } else {
                    this.setDropdown();
                }
            },
            `Input a ${options.fieldName} manually`,
        );
        const container = document.createElement("div");
        container.classList.add("cean-input-grid", "cean-input-and-button");
        container.append(comboboxInput.container, textInput.container, manualButton);

        super(key, container, options);
        this.comboboxInput = comboboxInput;
        this.textInput = textInput;

        if (choices.length > 0) {
            this.setDropdown();
        } else {
            this.setManual();
            manualButton.querySelector("input")!.disabled = true;
            manualButton.title = "Selection not available";
        }

        this.relayEventsFrom(this.comboboxInput);
        this.relayEventsFrom(this.textInput);
    }

    relayEventsFrom(input: InputComponent<string>) {
        input.container.addEventListener("input-updated", ((e: UpdateEvent) => {
            e.stopPropagation();
            this.updated(e.userTriggered);
        }) as EventListener);
    }

    destroy() {
        this.textInput.destroy();
        this.comboboxInput.destroy();
    }

    get id(): string {
        return this.id_;
    }

    get value(): string | null {
        return this.getActive().value;
    }

    setSilent(value: string | null) {
        if (this.locked) return;
        this.getActive().setSilent(value);
    }

    setSignaling(value: string | null, userTriggered: boolean = true) {
        this.getActive().setSignaling(value, userTriggered);
        this.updated(userTriggered);
    }

    lock() {
        super.lock();
        this.textInput.lock();
        this.comboboxInput.lock();
    }

    private setManual() {
        this.deactivate(this.comboboxInput);
        this.activate(this.textInput, this.comboboxInput.value);
        // No this.updated() because the value has not changed.
    }

    private setDropdown() {
        this.deactivate(this.textInput);
        this.activate(this.comboboxInput, null);
        this.updated();
    }

    private activate(component: InputComponent<string>, value: string | null) {
        const input = component.container.querySelector("input");
        if (input !== null) {
            input.id = this.id;
        }
        component.setSilent(value);
        component.container.style.display = "block";
        input?.focus();
    }

    private deactivate(component: InputComponent<string>) {
        const input = component.container.querySelector("input");
        if (input !== null) {
            input.id = "";
        }
        component.container.style.display = "none";
    }

    private getActive(): TextInput | ComboboxInput {
        if (this.textInput.container.style.display === "block") {
            return this.textInput;
        } else {
            return this.comboboxInput;
        }
    }
}
