import { Instance } from "../models.ts";
import { simpleLink } from "../components";
import { TextInput } from "../components/input";
import scicatLogo from "../assets/img/SciCat_logo_icon.svg";

export class InstanceSelection {
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
    img.src = `${instance.frontendUrl}/assets/images/site-header-logo.png`;

    const nameElement = document.createElement("div");
    nameElement.className = "cean-signin-instance-name";
    nameElement.textContent = instance.name;

    const urlElement = document.createElement("div");
    urlElement.className = "cean-signin-instance-url";
    urlElement.innerHTML = simpleLink(instance.frontendUrl);

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
    instanceItem.dataset.url = instance.frontendUrl.toLowerCase();
    instanceItem.append(logoContainer, textContainer, signInButton, tokenButton);

    return instanceItem;
}

function instanceMatches(instance: HTMLElement, pattern: string): boolean {
    return (
        (instance.dataset.name?.indexOf(pattern) ?? -1) > -1 ||
        (instance.dataset.url?.indexOf(pattern) ?? -1) > -1
    );
}
