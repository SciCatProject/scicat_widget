import { Instance } from "../models.ts";
import { iconTextButton, simpleLink } from "../components";
import { TextInput } from "../components/input";
import { createTokenAnalysisCache } from "../validation.ts";
import { createLabelFor } from "./util.ts";

export class TokenEntry {
    readonly element: HTMLDivElement;

    constructor(
        instance: Instance,
        onSubmit: (token: string) => void,
        onCancel: () => void,
    ) {
        this.element = createTokenEntryElements(instance, onSubmit, onCancel);
    }
}

function createTokenEntryElements(
    instance: Instance,
    onSubmit: (token: string) => void,
    onCancel: () => void,
): HTMLDivElement {
    const heading = document.createElement("h3");
    const headingA = document.createTextNode('Sign in to "');
    const instanceNameEl = document.createElement("b");
    instanceNameEl.textContent = instance.name;
    const headingB = document.createTextNode('" with a token');
    heading.append(headingA, instanceNameEl, headingB);

    const explanation = document.createElement("p");
    explanation.innerHTML = `Paste your SciCat token from
    ${simpleLink(instance.frontendUrl + "/user")}
    into the input below to sign in with the widget.`;

    const fileNote = document.createElement("p");
    fileNote.innerHTML =
        "Be aware that you cannot upload files with this method. " +
        "Either use the 'Sign In' button or pass a Scitacean client to the " +
        "widget directly. See also " +
        simpleLink(
            "https://www.scicatproject.org/scitacean/user-guide/connecting.html",
        );

    const submitButton = iconTextButton(
        "sign-in-alt",
        "Sign in",
        () => {
            const value = input.value;
            if (value !== null) {
                onSubmit(value);
            }
        },
        "Submit token",
    );
    submitButton.disabled = true;

    const backButton = iconTextButton(
        "chevron-left",
        "Back",
        onCancel,
        "Back to instance selection",
    );

    const buttonWrap = document.createElement("div");
    buttonWrap.className = "cean-token-entry-buttons";
    buttonWrap.append(backButton, submitButton);

    const tokenAnalysis = createTokenAnalysisCache();

    const input = new TextInput("token", {
        placeholder: "Token ...",
        type: "password",
        disablePasswordManager: true,
        validator: (token) => tokenAnalysis.get(token).error,
    });
    const label = createLabelFor(
        input,
        "SciCat token",
        "Enter your SciCat login token",
    );
    const tokenWarning = document.createElement("output");
    tokenWarning.className = "cean-warning";
    input.container.append(tokenWarning); // append to input to get consistent height

    const checkToken = () => {
        tokenWarning.textContent = tokenAnalysis.get(input.value).warning ?? "";
        submitButton.disabled = !input.value || !input.isValid();
    };
    // "input" fires while typing, "input-updated" when the value is set
    // programmatically, e.g., by the clear button.
    input.container.addEventListener("input", checkToken);
    input.container.addEventListener("input-updated", checkToken);

    input.container.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.code === "Enter" || e.code === "NumpadEnter") {
            submitButton.click();
        }
    });

    const fieldset = document.createElement("fieldset");
    fieldset.append(label, input.container, buttonWrap);

    const container = document.createElement("div");
    container.className = "cean-token-entry";
    container.append(heading, explanation, fileNote, fieldset);
    return container;
}
