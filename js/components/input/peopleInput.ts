import { InputComponent, InputOptions, UpdateEvent } from "./inputComponent.ts";
import { Person } from "../../models.ts";
import { removeButton, textButton } from "../button.ts";
import { Options as TextInputOptions, TextInput } from "./textInput.ts";
import { validateOrcid } from "../../validation.ts";
import { createLabelFor } from "../../forms";

export class PeopleInput extends InputComponent<Person[]> {
    private peopleComponents: Map<string, PersonInput>;
    private readonly peopleContainer: HTMLDivElement;

    constructor(key: string, options: InputOptions<Person[]>) {
        const peopleContainer = document.createElement("div");
        peopleContainer.className = "cean-people";

        const addButton = textButton(
            "Add person",
            () => {
                this.addPerson();
            },
            "Add person",
        );

        const container = document.createElement("div");
        container.id = crypto.randomUUID();
        container.append(peopleContainer, addButton);

        super(key, container, options);

        this.peopleContainer = peopleContainer;
        this.peopleComponents = new Map();
        this.addPerson();
    }

    get value(): Person[] | null {
        const results = Array.from(this.peopleComponents.values())
            .map((component) => component.value)
            .filter((value): value is Person => value !== null);
        return results.length > 0 ? results : null;
    }

    setSilent(value: Person[] | null) {
        this.peopleContainer.replaceChildren();
        this.peopleComponents.clear();

        const people = value ?? [];
        if (people.length === 0) {
            this.addPerson();
        } else {
            for (const person of people) {
                const personInput = new PersonInput(this.removePerson.bind(this));
                personInput.setSilent(person);
                this.peopleComponents.set(personInput.id, personInput);
                this.peopleContainer.append(personInput.element);
            }
        }
    }

    disableEditing() {
        super.disableEditing();
        for (const person of this.peopleComponents.values()) {
            person.disableEditing();
        }
        this.container.classList.add("cean-locked");
    }

    get id(): string {
        // There is no default input element a label could point to.
        return this.peopleContainer.id;
    }

    private addPerson() {
        const personInput = new PersonInput(this.removePerson.bind(this));
        personInput.element.addEventListener("input-updated", () => {
            this.updated();
        });
        this.peopleComponents.set(personInput.id, personInput);
        this.peopleContainer.append(personInput.element);
    }

    private removePerson(id: string) {
        this.peopleComponents.get(id)?.element.remove();
        this.peopleComponents.delete(id);
        if (this.peopleComponents.size === 0) {
            this.addPerson();
        }
        this.updated();
    }
}

class PersonInput {
    private readonly fieldset: HTMLFieldSetElement;
    private readonly nameInput: TextInput;
    private readonly emailInput: TextInput;
    private readonly orcidInput: TextInput;

    constructor(onRemove: (id: string) => void) {
        const [fieldset, nameInput, emailInput, orcidInput] =
            createPersonElements(onRemove);
        this.fieldset = fieldset;
        this.nameInput = nameInput;
        this.emailInput = emailInput;
        this.orcidInput = orcidInput;

        for (const el of [
            nameInput.container,
            emailInput.container,
            orcidInput.container,
        ]) {
            el.addEventListener("input-updated", ((e: UpdateEvent) => {
                e.stopPropagation();
                this.fieldset.dispatchEvent(new UpdateEvent(this.id, this.value, true));
            }) as EventListener);
        }
    }

    get value(): Person | null {
        const name = this.nameInput.value;
        const email = this.emailInput.value;
        const orcid = this.orcidInput.value;
        if (!name && !email && !orcid) {
            return null;
        }
        return {
            name: name ?? "", // Validation will fail if the name is empty because it is `required`.
            email: email ?? undefined,
            orcid: orcid ?? undefined,
        };
    }

    setSilent(value: Person | null) {
        this.nameInput.setSilent(value?.name ?? null);
        this.emailInput.setSilent(value?.email ?? null);
        this.orcidInput.setSilent(value?.orcid ?? null);
    }

    disableEditing() {
        this.nameInput.disableEditing();
        this.emailInput.disableEditing();
        this.orcidInput.disableEditing();
    }

    get element(): HTMLFieldSetElement {
        return this.fieldset;
    }

    get id(): string {
        return this.fieldset.id;
    }
}

function createPersonElements(
    onRemove: (id: string) => void,
): [HTMLFieldSetElement, TextInput, TextInput, TextInput] {
    const id = crypto.randomUUID();

    const [nameLabel, nameInput] = createPersonInputPart("personName", {
        required: true,
    });
    const [emailLabel, emailInput] = createPersonInputPart("personEmail", {
        type: "email",
    });
    const [orcidLabel, orcidInput] = createPersonInputPart("personORCID", {
        validator: validateOrcid,
    });
    const button = removeButton(() => {
        onRemove(id);
    });
    button.style.gridColumn = "3";

    const fieldset = document.createElement("fieldset");
    fieldset.id = id;
    fieldset.className = "cean-person cean-input-grid";
    fieldset.append(
        nameLabel,
        nameInput.container,
        button,
        emailLabel,
        emailInput.container,
        orcidLabel,
        orcidInput.container,
    );

    return [fieldset, nameInput, emailInput, orcidInput];
}

function createPersonInputPart(
    key: string,
    options: TextInputOptions,
): [HTMLLabelElement, TextInput] {
    const input = new TextInput(key, options);
    const label = createLabelFor(input);

    label.style.gridColumn = "1";
    input.container.style.gridColumn = "2";

    return [label, input];
}
