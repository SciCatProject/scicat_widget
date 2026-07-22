import { TextInput } from "../components/input";
import { Instance } from "../models.ts";
import scicatLogo from "../assets/img/SciCat_logo_icon.svg";

export class SignIn {
    readonly element: HTMLDivElement;

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
        this.element.append(createInstanceSelection(instances));
    }
}

function createInstanceSelection(instances: Instance[]): HTMLDivElement {
    const searchBar = new TextInput("instanceSearch", { placeholder: "Search..." });

    const buttonList = document.createElement("div");
    buttonList.className = "cean-signin-buttons";
    buttonList.append(...instances.map(createInstanceItem));

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

function createInstanceItem(instance: Instance): HTMLDivElement {
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
    signInButton.append(signInLabel);

    const manualLabel = document.createElement("label");
    manualLabel.textContent = "Manual";
    const manualButton = document.createElement("button");
    manualButton.className = "cean-button";
    manualButton.append(manualLabel);

    if (instance.supportsSSO) {
        signInButton.classList.add("cean-primary-choice");
    } else {
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
