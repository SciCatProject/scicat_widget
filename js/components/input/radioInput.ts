import { InputComponent, InputOptions } from "./inputComponent.ts";

export type RadioChoice = {
    value: string;
    display: string;
    description: string;
};

export interface Options extends InputOptions<string> {
    choices: RadioChoice[];
    initial?: string;
}

/** A group of radio buttons with an extra custom input.
 *
 * WARNING
 * Event handling is not implemented as it is unnecessary at the time of writing.
 */
export class RadioInput extends InputComponent<string> {
    private readonly fieldset: HTMLFieldSetElement;
    private readonly customCheckbox: HTMLInputElement;
    private readonly customInput: HTMLInputElement;

    constructor(key: string, options: Options) {
        const [fieldset, customCheckbox, customInput] = makeElements(
            options.choices,
            options.required,
        );

        const validator = (value: string | null) => {
            if (value === null) return "Please select a value or fill in some text";
            return null;
        };

        super(key, fieldset, { ...options, validator });
        this.fieldset = fieldset;
        this.customCheckbox = customCheckbox;
        this.customInput = customInput;

        this.checkboxes().forEach((checkbox) => {
            checkbox.addEventListener("click", () => {
                this.updated(true);
            });
        });
        this.triggerUpdatesFrom(this.customInput);

        this.setupValidation();
        if (options.initial !== undefined) this.setSignaling(options.initial, false);
    }

    get value(): string | null {
        for (const checkbox of this.checkboxes()) {
            if (checkbox.checked) {
                if (checkbox == this.customCheckbox) {
                    return this.customInput.value || null;
                } else {
                    return checkbox.value;
                }
            }
        }
        return null;
    }

    setSilent(value: string | null) {
        let found = false;
        for (const checkbox of this.checkboxes()) {
            const thisOne = checkbox.value == value;
            checkbox.checked = thisOne;
            found = found || thisOne;
        }

        if (!found) {
            this.customCheckbox.checked = true;
            this.customInput.value = value ?? "";
        }
    }

    get id(): string {
        return this.fieldset.id;
    }

    disableEditing() {
        super.disableEditing();
        for (const checkbox of this.checkboxes()) {
            checkbox.disabled = true;
        }
        this.customInput.disabled = true;
    }

    protected get validationElement(): HTMLElement {
        return this.customInput;
    }

    private setupValidation() {
        // Trigger validation after a delay do debounce events. E.g.:
        // 1. User selects custom
        // 2. User does not enter text
        // 3. User selects static input
        // => Blur of customInput fires and fails validation, then click of checkbox
        //    fires and resets to valid. The validation message flickers briefly.
        // Debouncing avoids that.
        let validationTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleValidation = () => {
            if (validationTimer !== null) clearTimeout(validationTimer);
            validationTimer = setTimeout(() => {
                validationTimer = null;
                this.validate();
            }, 200);
        };

        for (const checkbox of this.checkboxes()) {
            if (checkbox != this.customCheckbox) {
                checkbox.addEventListener("click", scheduleValidation);
            }
        }
        this.customInput.addEventListener("input", scheduleValidation);
        this.customInput.addEventListener("blur", scheduleValidation);
    }

    private checkboxes(): NodeListOf<HTMLInputElement> {
        return this.fieldset.querySelectorAll("input[type='radio']");
    }
}

function makeElements(
    choices: RadioChoice[],
    required?: boolean,
): [HTMLFieldSetElement, HTMLInputElement, HTMLInputElement] {
    const setId = crypto.randomUUID();
    const fieldset = document.createElement("fieldset");
    fieldset.id = crypto.randomUUID();
    fieldset.className = "cean-radio-group";

    for (const choice of choices) {
        const [checkbox, label] = makeCheckboxWithLabel(setId, choice, required);
        const wrap = document.createElement("div");
        wrap.append(checkbox, label);
        fieldset.append(wrap);
    }

    const [customWrap, customCheckbox, customInput] = makeCustomInput(setId, required);
    fieldset.append(customWrap);

    return [fieldset, customCheckbox, customInput];
}

function makeCustomInput(
    setId: string,
    required?: boolean,
): [HTMLDivElement, HTMLInputElement, HTMLInputElement] {
    const customCheckboxValue = crypto.randomUUID();
    const [checkbox, label] = makeCheckboxWithLabel(
        setId,
        {
            value: customCheckboxValue,
            description: "Custom value",
            display: "Custom value",
        },
        required,
    );
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.placeholder = "Custom";
    customInput.className = "cean-input";

    customInput.addEventListener("input", () => {
        checkbox.checked = true;
    });
    customInput.addEventListener("click", () => {
        checkbox.checked = true;
    });
    checkbox.addEventListener("click", () => {
        customInput.focus();
        customInput.select();
    });

    const wrap = document.createElement("div");
    wrap.className = "cean-radio-custom-row";
    wrap.append(checkbox, label, customInput);
    return [wrap, checkbox, customInput];
}

function makeCheckboxWithLabel(
    setId: string,
    choice: RadioChoice,
    required?: boolean,
): [HTMLInputElement, HTMLLabelElement] {
    const id = crypto.randomUUID();
    const checkbox = document.createElement("input");
    checkbox.type = "radio";
    checkbox.id = id;
    checkbox.name = setId;
    checkbox.value = choice.value;
    checkbox.title = choice.description;
    checkbox.required = required ?? false;

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = choice.display;
    label.title = choice.description;

    return [checkbox, label];
}
