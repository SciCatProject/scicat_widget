import { InputComponent, InputOptions } from "./inputComponent.ts";

export class DatetimeInput extends InputComponent<Date> {
    private readonly dateElement: HTMLInputElement;
    private readonly timeElement: HTMLInputElement;

    constructor(key: string, options: InputOptions<Date>) {
        const dateElement = document.createElement("input");
        dateElement.id = crypto.randomUUID();
        dateElement.name = key;
        dateElement.type = "date";
        dateElement.required = options.required ?? false;
        dateElement.classList.add("cean-input");
        InputComponent.suppressEnter(dateElement);

        const timeElement = document.createElement("input");
        timeElement.id = `${dateElement.id}-time`;
        timeElement.type = "time";
        timeElement.step = "1";
        timeElement.classList.add("cean-input");
        InputComponent.suppressEnter(timeElement);

        const wrap = document.createElement("div");
        wrap.className = "cean-datetime-input";
        wrap.append(dateElement, timeElement, createTimezoneElement());

        super(key, wrap, options);
        this.dateElement = dateElement;
        this.timeElement = timeElement;
        this.addValidationListener(this.dateElement);
    }

    // Custom override so this returns the date element's id, not the wrap element's.
    get id(): string {
        return this.dateElement.id;
    }

    get value(): Date | null {
        const dateVal = this.dateElement.value;
        if (dateVal === "") return null;

        const timeVal = this.timeElement.value || "00:00:00";
        return new Date(`${dateVal}T${timeVal}`);
    }

    setSilent(value: Date | string | null) {
        if (!value) {
            this.dateElement.value = "";
            this.timeElement.value = "";
            return;
        }
        if (!(value instanceof Date)) {
            value = new Date(value);
        }

        const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
        const dateString = localDate.toISOString();
        this.dateElement.value = dateString.slice(0, 10);
        this.timeElement.value = dateString.slice(11, 19);
    }

    disableEditing() {
        super.disableEditing();
        this.dateElement.disabled = true;
        this.timeElement.disabled = true;
    }
}

function getLocalTimezoneLabel(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

function createTimezoneElement(): HTMLSpanElement {
    const timezoneLabel = document.createElement("span");
    timezoneLabel.className = "cean-datetime-timezone";
    timezoneLabel.textContent = getLocalTimezoneLabel();
    timezoneLabel.title =
        "Dates and times are in your browser's local timezone. They will be converted to Universal Coordinated Time (UTC) during upload.";
    return timezoneLabel;
}
