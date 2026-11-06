import { TextInput } from "../components/input";
import { Instance } from "../models.ts";
import scicatLogo from "../assets/img/SciCat_logo_icon.svg";
import { createLabelFor } from "./util.ts";
import { iconTextButton, simpleLink } from "../components";

export class SignIn {
    readonly element: HTMLDivElement;

    private readonly instances: Instance[];
    private state: State;
    private readonly instanceSelection: InstanceSelection;

    constructor() {
        const instances = [
            {
                name: "ESS Staging",
                url: "https://staging.scicat.ess.eu",
                supportsSSO: true,
            },
            { name: "ESS Production", url: "https://scicat.ess.eu", supportsSSO: true },
            { name: "MAX IV", url: "https://scicat.maxiv.lu.se", supportsSSO: false },
            { name: "PSI", url: "https://discovery.psi.ch", supportsSSO: false },
            {
                name: "ALSO",
                url: "https://dataportal.also.lbl.gov",
                supportsSSO: false,
            },
            { name: "DESY", url: "https://public-data.desy.de", supportsSSO: false },
            { name: "HZDR", url: "https://scicat.hzdr.de", supportsSSO: false },
            { name: "ILL", url: "https://scicat.ill.fr", supportsSSO: false },
        ];

        this.element = document.createElement("div");
        this.instances = instances;
        this.instanceSelection = this.createInstanceSelection();
        this.state = this.instanceSelection;
        this.element.replaceChildren(this.state.element);
    }

    private createInstanceSelection(): InstanceSelection {
        return new InstanceSelection(
            this.instances,
            (instance) => {
                // TODO
                console.error("SSO not implemented");
            },
            (instance) => {
                this.transitionState(this.createTokenEntry(instance));
            },
        );
    }

    private createTokenEntry(instance: Instance): TokenEntry {
        return new TokenEntry(
            instance,
            (token: string) => {
                console.log("submitting");
            },
            () => {
                this.transitionState(this.instanceSelection);
            },
        );
    }

    private transitionState(newState: State) {
        this.state = newState;
        this.element.replaceChildren(this.state.element);
    }
}

type State = InstanceSelection | TokenEntry;

class InstanceSelection {
    readonly element: HTMLDivElement;

    constructor(
        instances: Instance[],
        onSelectSSO: (instance: Instance) => void,
        onSelectToken: (instance: Instance) => void,
    ) {
        this.element = document.createElement("div");
        this.element.append(
            createInstanceSelection(instances, onSelectSSO, onSelectToken),
        );
    }
}

class TokenEntry {
    readonly element: HTMLDivElement;

    constructor(
        instance: Instance,
        onSubmit: (token: string) => void,
        onCancel: () => void,
    ) {
        this.element = createTokenEntryElements(instance, onSubmit, onCancel);
    }
}

function createInstanceSelection(
    instances: Instance[],
    onSelectSSO: (instance: Instance) => void,
    onSelectToken: (instance: Instance) => void,
): HTMLDivElement {
    const searchBar = new TextInput("instanceSearch", { placeholder: "Filter ..." });
    searchBar.container.classList.add("cean-signin-filter");

    const instanceList = document.createElement("div");
    instanceList.className = "cean-signin-instances";
    for (const instance of instances) {
        instanceList.append(createInstanceItem(instance, onSelectSSO, onSelectToken));
    }

    const applyFilter = () => {
        const filter = (searchBar.value ?? "").toLowerCase().trim();
        instanceList.querySelectorAll(".cean-signin-instance").forEach((element) => {
            const el = element as HTMLElement;
            el.style.display = instanceMatches(el, filter) ? "" : "none";
        });
    };
    // "input" fires while typing, "input-updated" when the value is set
    // programmatically, e.g., by the clear button.
    searchBar.container.addEventListener("input", applyFilter);
    searchBar.container.addEventListener("input-updated", applyFilter);

    const panel = document.createElement("div");
    panel.className = "cean-signin-panel";
    panel.append(searchBar.container, instanceList);
    return panel;
}

function createInstanceItem(
    instance: Instance,
    onSelectSSO: (instance: Instance) => void,
    onSelectToken: (instance: Instance) => void,
): HTMLDivElement {
    const logoContainer = document.createElement("div");
    logoContainer.className = "cean-signin-logo";
    // Show the generic SciCat logo until the instance logo has loaded.
    // If it fails to load, the generic logo stays.
    logoContainer.innerHTML = scicatLogo;
    const img = document.createElement("img");
    img.alt = "";
    img.title = instance.name;
    img.addEventListener("load", () => logoContainer.replaceChildren(img), {
        once: true,
    });
    img.src = `${instance.url}/assets/images/site-header-logo.png`;

    const nameElement = document.createElement("div");
    nameElement.className = "cean-signin-instance-name";
    nameElement.textContent = instance.name;

    const urlElement = document.createElement("div");
    urlElement.className = "cean-signin-instance-url";
    urlElement.innerHTML = simpleLink(instance.url);

    const textContainer = document.createElement("div");
    textContainer.className = "cean-signin-instance-text";
    textContainer.append(nameElement, urlElement);

    const signInButton = document.createElement("button");
    signInButton.className = "cean-button";
    signInButton.textContent = "Sign In";
    signInButton.addEventListener("click", () => onSelectSSO(instance));

    const tokenButton = document.createElement("button");
    tokenButton.className = "cean-button";
    tokenButton.textContent = "Token";
    tokenButton.title = "Sign in with a SciCat token";
    tokenButton.addEventListener("click", () => onSelectToken(instance));

    if (!instance.supportsSSO) {
        signInButton.disabled = true;
        signInButton.title = "Sign in not available for this SciCat instance.";
    }

    const instanceItem = document.createElement("div");
    instanceItem.className = "cean-signin-instance";
    instanceItem.dataset.name = instance.name.toLowerCase();
    instanceItem.dataset.url = instance.url.toLowerCase();
    instanceItem.append(logoContainer, textContainer, signInButton, tokenButton);

    return instanceItem;
}

function instanceMatches(instance: HTMLElement, pattern: string): boolean {
    return (
        (instance.dataset.name?.indexOf(pattern) ?? -1) > -1 ||
        (instance.dataset.url?.indexOf(pattern) ?? -1) > -1
    );
}

function createTokenEntryElements(
    instance: Instance,
    onSubmit: (token: string) => void,
    onCancel: () => void,
): HTMLDivElement {
    const heading = document.createElement("h3");
    heading.textContent = `Sign in to ${instance.name} with a token`;

    const explanation = document.createElement("div");
    explanation.innerHTML = `Paste your SciCat token from
    ${simpleLink(instance.url + "/user")}
    into the input below to sign in with the widget.`;

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
    buttonWrap.append(backButton, submitButton);

    const tokenAnalysis = createTokenAnalysisCache();

    const input = new TextInput("token", {
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

    input.container.addEventListener("input", () => {
        tokenWarning.textContent = tokenAnalysis.get(input.value).warning ?? "";
        submitButton.disabled = !input.value || !input.isValid();
    });
    input.container.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.code === "Enter" || e.code === "NumpadEnter") {
            submitButton.click();
        }
    });

    const fieldset = document.createElement("fieldset");
    fieldset.append(label, input.container, buttonWrap);

    const container = document.createElement("div");
    container.className = "cean-token-entry";
    container.append(heading, explanation, fieldset);
    return container;
}

interface TokenAnalysis {
    error: string | null;
    warning: string | null;
}

function createTokenAnalysisCache(): { get: (token: string | null) => TokenAnalysis } {
    let previousToken: string | null | undefined = undefined;
    let previousAnalysis: TokenAnalysis = { error: null, warning: null };

    return {
        get(token: string | null): TokenAnalysis {
            if (token === previousToken) {
                return previousAnalysis;
            }

            previousToken = token;
            previousAnalysis = analyzeToken(token);
            return previousAnalysis;
        },
    };
}

function analyzeToken(token: string | null): TokenAnalysis {
    if (token === null) {
        return { error: null, warning: null };
    }
    const parsed = tryParseJWT(token);
    if (typeof parsed === "string") {
        return { error: parsed, warning: null };
    }

    const expiresIn = jwtExpiration(parsed).getTime() - new Date().getTime();
    if (expiresIn <= 0) {
        return {
            error: "The token has expired. Please generate a new token.",
            warning: null,
        };
    } else if (expiresIn < 5 * 60 * 1000) {
        return {
            error: null,
            warning: "Warning: the token expires in less than 5 minutes.",
        };
    }
    return { error: null, warning: null };
}

function tryParseJWT(token: string): Record<string, any> | string {
    try {
        return parseJwt(token);
    } catch (error) {
        return "Malformed token. Please enter a correct token.";
    }
}

function parseJwt(token: string): Record<string, any> {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
        window
            .atob(base64)
            .split("")
            .map((c) => {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join(""),
    );
    return JSON.parse(jsonPayload);
}

function jwtExpiration(token: Record<string, any>): Date {
    const timestamp = token.exp as number;
    return new Date(timestamp * 1000);
}
