import { InputComponent, InputOptions } from "./inputComponent.ts";
import { iconButton } from "../button.ts";

/*
TODO Better display = search
 - Do not use textContent for search
 -  Do not insert textContent into search bar
 - Use Choice.text
        Can be stored in the option with option.label = choice.text
 */

export type Choice = {
    key: string;
    text: string;
};

export interface Options extends InputOptions<string> {
    renderChoice?: (choice: Choice) => HTMLElement;
}

type ComboboxListElement = HTMLDivElement;
type ComboboxOptionElement = HTMLDivElement;

/**
 * Input component to select text from a list of options.
 */
export class ComboboxInput extends InputComponent<string> {
    private readonly listbox: ComboboxListElement;
    private readonly searchBar: HTMLInputElement;

    private error: string = "";
    private currentFocus: number | null = null;
    private readonly closeListener: (e: MouseEvent) => void;

    constructor(key: string, choices: Choice[], options: Options) {
        const listbox = createListbox(choices, options.renderChoice);
        const searchBar = createSearchBar(key, listbox.id);
        const [insert, _] = InputComponent.createInsert(searchBar, null);
        insert.appendChild(createChevron(searchBar));

        const container = document.createElement("div");
        container.id = crypto.randomUUID();
        container.className = "cean-combobox cean-input-container";
        container.append(searchBar, listbox, insert);

        super(key, container, options);

        this.listbox = listbox;
        this.searchBar = searchBar;

        this.searchBar.addEventListener("focus", this.open.bind(this));
        this.searchBar.addEventListener("input", () => {
            this.open();
            filterOptions(this.searchBar.value, this.listbox);
            this.setActive(firstVisibleOption(this.listbox));
        });
        this.searchBar.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.code === "Tab") {
                // Focus moves to the next element.
                // Cannot use blur events as that would trigger when the user clicks into the listbox.
                this.blur();
            } else if (e.code === "ArrowUp") {
                e.preventDefault();
                this.setActive(findPreviousOption(this.listbox, this.currentFocus));
            } else if (e.code === "ArrowDown") {
                e.preventDefault();
                this.setActive(findNextOption(this.listbox, this.currentFocus));
            } else if (e.code == "Enter" || e.code == "NumpadEnter") {
                e.preventDefault();
                e.stopPropagation();
                this.selectActive();
            } else if (e.code === "Escape") {
                this.close();
            }
        });

        this.listbox.addEventListener("selected-option", ((event: SelectedEvent) => {
            this.close();
            if (event.text !== this.searchBar.value) {
                this.searchBar.value = event.text;
                this.error = "";
                this.updated();
            }
        }) as EventListener);

        this.closeListener = (e: MouseEvent) => {
            if (!e.composedPath().includes(container)) {
                if (
                    this.listbox.style.display !== "none" ||
                    document.activeElement === this.searchBar
                ) {
                    this.blur();
                }
            }
        };
        document.addEventListener("click", this.closeListener);

        this.addValidationListener(this.searchBar);
    }

    destroy() {
        document.removeEventListener("click", this.closeListener);
    }

    /** Override to provide the actual input field's id. */
    get id(): string {
        return this.searchBar.id;
    }

    get value(): string | null {
        return this.getSelected()?.dataset.value || null;
    }

    setSilent(value: string | null) {
        deselectAll(this.listbox);
        const match = value === null ? null : findOptionByValue(this.listbox, value);
        if (match !== null) {
            selectOption(match);
            this.searchBar.value = optionText(match);
            this.error = "";
            filterOptions(value ?? "", this.listbox);
            this.setActive(optionIndex(this.listbox, match));
            this.validate();
            return;
        }

        this.searchBar.value = value ?? "";
        showAllOptions(this.listbox);
        this.setActive(null);
        this.error = value === null || value === "" ? "" : "Value not recognized";
        this.validate();
    }

    disableEditing() {
        super.disableEditing();
        this.searchBar.disabled = true;
    }

    get options(): HTMLCollectionOf<HTMLElement> {
        return this.listbox.children as HTMLCollectionOf<HTMLElement>;
    }

    validate() {
        // Override base class validate because baseInputElement does not
        // support validation. So build it around searchBar instead.
        this.searchBar.setCustomValidity(this.error);
        if (!this.searchBar.validity.valid) {
            this.statusElement.textContent = this.searchBar.validationMessage;
        } else {
            this.statusElement.textContent = "";
        }
    }

    private getActive(): ComboboxOptionElement | null {
        for (const option of listboxOptions(this.listbox)) {
            if (option.classList.contains("cean-active")) {
                return option;
            }
        }
        return null;
    }

    private getSelected(): ComboboxOptionElement | null {
        for (const option of listboxOptions(this.listbox)) {
            if (option.getAttribute("aria-selected") === "true") {
                return option;
            }
        }
        return null;
    }

    private findExactTextMatch(text: string): ComboboxOptionElement | null {
        const normalized = text.trim();
        for (const option of listboxOptions(this.listbox)) {
            if (optionText(option).trim() === normalized) {
                return option;
            }
        }
        return null;
    }

    private setActive(index: number | null) {
        this.currentFocus = index;
        selectActive(this.listbox, index);

        const active = this.getActive();
        if (active !== null) {
            this.searchBar.setAttribute("aria-activedescendant", active.id);
            active.scrollIntoView({ block: "nearest" });
        } else {
            this.searchBar.removeAttribute("aria-activedescendant");
        }
    }

    private selectActive() {
        const active = this.getActive();
        if (active !== null) {
            this.close();
            this.error = "";
            this.setSignaling(active.dataset.value || "");
            this.validate();
        }
        // else: do nothing, keep dropdown open
    }

    private blur() {
        this.close();
        const selected = this.getSelected();
        const text = this.searchBar.value.trim();
        if (!text) {
            // no search, remove selection
            deselectAll(this.listbox);
            this.searchBar.value = "";
            this.error = "";
            if (selected !== null) this.updated();
        } else if (selected !== null && this.searchBar.value === optionText(selected)) {
            // valid search, keep selection
            this.error = "";
        } else {
            const match = this.findExactTextMatch(text);
            if (match !== null) {
                deselectAll(this.listbox);
                selectOption(match);
                this.searchBar.value = optionText(match);
                this.error = "";
                this.updated();
            } else {
                deselectAll(this.listbox);
                this.error = "Value not recognized";
            }
        }
        // else: do nothing, keep current selection
        this.validate();
    }

    private open() {
        this.listbox.style.display = "block";
        this.searchBar.setAttribute("aria-expanded", "true");
    }

    private close() {
        this.listbox.style.display = "none";
        this.searchBar.setAttribute("aria-expanded", "false");
    }
}

function listboxOptions(
    listbox: ComboboxListElement,
): HTMLCollectionOf<ComboboxOptionElement> {
    return listbox.children as HTMLCollectionOf<ComboboxOptionElement>;
}

function optionText(option: ComboboxOptionElement): string {
    return option.textContent ?? "";
}

function optionIndex(
    listbox: ComboboxListElement,
    option: ComboboxOptionElement,
): number | null {
    const options = listboxOptions(listbox);
    for (let i = 0; i < options.length; ++i) {
        if (options[i] === option) return i;
    }
    return null;
}

function findOptionByValue(
    listbox: ComboboxListElement,
    value: string,
): ComboboxOptionElement | null {
    for (const option of listboxOptions(listbox)) {
        if (option.dataset.value === value) {
            return option;
        }
    }
    return null;
}

function selectOption(option: ComboboxOptionElement) {
    option.setAttribute("aria-selected", "true");
}

function selectActive(listbox: ComboboxListElement, index: number | null) {
    removeActive(listbox);
    if (index === null) return;
    const opt = listboxOptions(listbox)[index];
    if (!opt) return;
    opt.classList.add("cean-active");
}

function removeActive(listbox: ComboboxListElement) {
    for (const opt of listboxOptions(listbox)) {
        opt.classList.remove("cean-active");
    }
}

function defaultRenderChoice(choice: Choice): HTMLElement {
    const key = document.createElement("span");
    key.className = "cean-item-key";
    key.textContent = choice.key;
    const label = document.createElement("span");
    label.className = "cean-item-text";
    label.textContent = choice.text;

    const wrap = document.createElement("div");
    wrap.append(key, label);
    return wrap;
}

function createSearchBar(key: string, listboxId: string): HTMLInputElement {
    const searchBar = document.createElement("input");
    searchBar.id = crypto.randomUUID();
    searchBar.name = key;
    searchBar.type = "text";
    searchBar.role = "combobox";
    searchBar.autocomplete = "off";
    searchBar.placeholder = "Select ...";
    searchBar.className = "cean-input";
    searchBar.setAttribute("aria-autocomplete", "list");
    searchBar.setAttribute("aria-controls", listboxId);
    searchBar.setAttribute("aria-expanded", "false");
    searchBar.setAttribute("aria-haspopup", "listbox");

    return searchBar;
}

function firstVisibleOption(listbox: ComboboxListElement): number | null {
    const options = listboxOptions(listbox);
    for (let i = 0; i < options.length; ++i) {
        if (options[i].style.display !== "none") {
            return i;
        }
    }
    return null;
}

function lastVisibleOption(listbox: ComboboxListElement): number | null {
    const options = listboxOptions(listbox);
    for (let i = options.length - 1; i >= 0; --i) {
        if (options[i].style.display !== "none") {
            return i;
        }
    }
    return null;
}

function createListbox(
    choices: Choice[],
    renderChoice?: (choice: Choice) => HTMLElement,
): ComboboxListElement {
    if (renderChoice === undefined) renderChoice = defaultRenderChoice;

    const listbox = document.createElement("div");
    listbox.id = crypto.randomUUID();
    listbox.role = "listbox";
    listbox.tabIndex = -1;
    listbox.className = "cean-combobox-list";
    listbox.style.display = "none";

    for (const choice of choices) {
        const option = document.createElement("div");
        option.id = crypto.randomUUID();
        option.role = "option";
        option.className = "cean-combobox-option";
        option.tabIndex = -1;
        option.dataset.value = choice.key;
        option.setAttribute("aria-selected", "false");
        option.appendChild(renderChoice(choice));
        listbox.appendChild(option);

        option.addEventListener("click", () => {
            deselectAll(listbox);
            selectOption(option);
            listbox.dispatchEvent(
                new SelectedEvent(choice.key, optionText(option), { bubbles: true }),
            );
        });
    }

    return listbox;
}

function deselectAll(listbox: ComboboxListElement) {
    for (const option of listboxOptions(listbox)) {
        option.setAttribute("aria-selected", "false");
    }
}

function findNextOption(
    listbox: ComboboxListElement,
    start: number | null,
): number | null {
    const options = listboxOptions(listbox);
    const len = options.length;
    if (len === 0) return null;
    if (start === null) return firstVisibleOption(listbox);

    for (let step = 1; step <= len; ++step) {
        const index = (start + step) % len;
        if (options[index].style.display !== "none") return index;
    }
    return null;
}

function findPreviousOption(
    listbox: ComboboxListElement,
    start: number | null,
): number | null {
    const options = listboxOptions(listbox);
    const len = options.length;
    if (len === 0) return null;
    if (start === null) return lastVisibleOption(listbox);

    for (let step = 1; step <= len; ++step) {
        const index = (start - step + len) % len;
        if (options[index].style.display !== "none") return index;
    }
    return null;
}

function showAllOptions(listbox: ComboboxListElement) {
    for (const option of listboxOptions(listbox)) {
        option.style.display = "block";
    }
}

function filterOptions(filter: string, listbox: ComboboxListElement) {
    const text = filter.toLowerCase();
    let nVisible = 0;
    for (const option of listboxOptions(listbox)) {
        if (optionText(option).toLowerCase().indexOf(text) > -1) {
            option.style.display = "block";
            nVisible++;
        } else {
            option.style.display = "none";
        }
    }

    if (nVisible === 1) {
        selectActive(listbox, firstVisibleOption(listbox));
    } else {
        removeActive(listbox);
    }
}

export class SelectedEvent extends Event {
    readonly key: string;
    readonly text: string;

    constructor(key: string, text: string, options?: EventInit) {
        super("selected-option", options);
        this.key = key;
        this.text = text;
    }
}

function createChevron(searchBar: HTMLInputElement): HTMLElement {
    const button = iconButton("chevron-down", () => {
        searchBar.focus();
    });
    button.classList.add("cean-chevron");
    button.tabIndex = -1;
    return button;
}
