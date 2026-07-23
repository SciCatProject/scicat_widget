import { TextInput } from "../components/input";
import { Instance } from "../models.ts";
import scicatLogo from "../assets/img/SciCat_logo_icon.svg";
import { createLabelFor } from "./util.ts";
import { iconTextButton } from "../components";

export class SignIn {
    readonly element: HTMLDivElement;

    private readonly instances: Instance[];
    private state: State;

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
        this.state = this.createInstanceSelection();
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
                this.state = this.createTokenEntry(instance);
                this.element.replaceChildren(this.state.element);
            },
        );
    }

    private createTokenEntry(instance: Instance): TokenEntry {
        return new TokenEntry(instance);
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

    constructor(instance: Instance) {
        this.element = createTokenEntryElements(instance);
    }
}

function createInstanceSelection(
    instances: Instance[],
    onSelectSSO: (instance: Instance) => void,
    onSelectToken: (instance: Instance) => void,
): HTMLDivElement {
    const searchBar = new TextInput("instanceSearch", { placeholder: "Search..." });

    const buttonList = document.createElement("div");
    buttonList.className = "cean-signin-buttons";
    for (const instance of instances) {
        buttonList.append(createInstanceItem(instance, onSelectSSO, onSelectToken));
    }

    searchBar.container.addEventListener("input", () => {
        const filter = (searchBar.value ?? "").toLowerCase().trim();
        buttonList.querySelectorAll(".cean-signin-instance").forEach((element) => {
            const el = element as HTMLElement;
            if (instanceMatches(el, filter)) {
                el.style.display = "grid";
            } else {
                el.style.display = "none";
            }
        });
    });

    const panel = document.createElement("div");
    panel.className = "cean-signin-panel";
    panel.append(searchBar.container, buttonList);
    return panel;
}

function createInstanceItem(
    instance: Instance,
    onSelectSSO: (instance: Instance) => void,
    onSelectToken: (instance: Instance) => void,
): HTMLDivElement {
    const shortUrl = instance.url.replace(/^https?:\/\//, "");

    const logoContainer = document.createElement("span");
    logoContainer.className = "cean-signin-logo-container";
    const img = document.createElement("img");
    img.src = `${instance.url}/assets/images/site-header-logo.png`;
    img.alt = "";
    img.onerror = () => {
        img.onerror = null; // Prevent infinite loop if the fallback also fails
        logoContainer.innerHTML = scicatLogo;
    };
    logoContainer.append(img);

    const bigLabel = document.createElement("label");
    bigLabel.textContent = shortUrl;

    const bigButton = document.createElement("button");
    bigButton.classList.add("cean-button", "cean-signin-big-button");
    bigButton.append(logoContainer, bigLabel);

    const signInLabel = document.createElement("label");
    signInLabel.textContent = "Sign in";
    const signInButton = document.createElement("button");
    signInButton.className = "cean-button";
    signInButton.addEventListener("click", () => onSelectSSO(instance));
    signInButton.append(signInLabel);

    const manualLabel = document.createElement("label");
    manualLabel.textContent = "Manual";
    const manualButton = document.createElement("button");
    manualButton.className = "cean-button";
    manualButton.addEventListener("click", () => onSelectToken(instance));
    manualButton.append(manualLabel);

    if (instance.supportsSSO) {
        bigButton.addEventListener("click", () => onSelectSSO(instance));
        signInButton.classList.add("cean-primary-choice");
    } else {
        bigButton.addEventListener("click", () => onSelectToken(instance));
        signInButton.disabled = true;
        signInButton.title = "Sign in not available for this SciCat instance.";
        manualButton.classList.add("cean-primary-choice");
    }

    const smallButtons = document.createElement("div");
    smallButtons.append(signInButton, manualButton);

    const instanceItem = document.createElement("div");
    instanceItem.className = "cean-signin-instance";
    instanceItem.dataset.name = instance.name.toLowerCase();
    instanceItem.dataset.url = instance.url.toLowerCase();
    instanceItem.append(bigButton, smallButtons);

    return instanceItem;
}

function instanceMatches(instance: HTMLElement, pattern: string): boolean {
    return (
        (instance.dataset.name?.indexOf(pattern) ?? -1) > -1 ||
        (instance.dataset.url?.indexOf(pattern) ?? -1) > -1
    );
}

function createTokenEntryElements(instance: Instance) {
    const heading = document.createElement("h3");
    heading.textContent = `Sign in to ${instance.name} with a token`;

    const explanation = document.createElement("div");
    explanation.innerHTML = `Past your SciCat token from <a target="_blank" href="${instance.url}/user">${instance.url}/user</a> into the
    input below to sign in with the widget.`;

    const submitButton = iconTextButton(
        "sign-in-alt",
        "Sign in",
        () => {
            console.log("submitting");
        },
        "Submit token",
    );
    submitButton.disabled = true;

    const input = new TextInput("token", {
        type: "password",
        validator: validateToken,
    });
    const label = createLabelFor(
        input,
        "SciCat token",
        "Enter your SciCat login token",
    );

    input.container.addEventListener("input", () => {
        submitButton.disabled = !input.value;
    });
    input.container.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.code === "Enter" || e.code === "NumpadEnter") {
            submitButton.click();
        }
    });

    const container = document.createElement("fieldset");
    container.append(heading, explanation, label, input.container, submitButton);
    return container;
}

function validateToken(token: string | null): string | null {
    if (token === null) {
        return null;
    }
    const parsed = tryParseJWT(token);
    if (typeof parsed === "string") {
        return parsed;
    }
    if (jwtExpiration(parsed).getTime() - new Date().getTime() < 5 * 60 * 1000) {
        return "Token expires in less than 5 minutes.";
    }
    return null;
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
