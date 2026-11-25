import type { RenderProps } from "@anywidget/types";
import "./datasetUploadWidget.css";
import { BackendComm } from "./comm.ts";
import { iconTextButton, simpleLink } from "./components";
import { Instance } from "./models.ts";
import { InstanceSelection, TokenEntry } from "./forms";

interface WidgetModel {
    instances: Instance[];
}

async function render({ model, el }: RenderProps<WidgetModel>) {
    const comm = new LoginComm(model);

    function onLogin(payload: ResLogin) {
        el.replaceChildren(
            createLoginResult(payload, () => {
                el.replaceChildren(instanceSelection.element);
            }),
        );
    }
    const [callLogin, cleanupLogin] = registerLoginCall(comm, onLogin);

    const instanceSelection = new InstanceSelection(
        model.get("instances"),
        (instance) => {
            callLogin({ instance_key: instance.key });
        },
        (instance) => {
            el.replaceChildren(createTokenEntry(instance).element);
        },
    );

    function createTokenEntry(instance: Instance): TokenEntry {
        return new TokenEntry(
            instance,
            (token: string) => {
                callLogin({ apiUrl: instance.apiUrl, token });
            },
            () => {
                el.replaceChildren(instanceSelection.element);
            },
        );
    }

    el.replaceChildren(instanceSelection.element);

    function onOpenBrowser(payload: ReqOpenBrowser) {
        window.open(payload.url, "_blank");
        // Short delay so the user only sees the message if the page
        // fails to open, or they come back.
        setTimeout(() => el.replaceChildren(createOpenBrowserMessage(payload)), 100);
    }
    comm.onReqOpenBrowser("", onOpenBrowser);

    return () => {
        cleanupLogin();
        comm.offReqOpenBrowser("");
        el.replaceChildren(); // do not save old messages to the notebook
    };
}

function createOpenBrowserMessage(payload: ReqOpenBrowser): HTMLDivElement {
    const container = document.createElement("div");

    const p = document.createElement("p");
    const codeHtml = payload.code !== undefined ? `<br>and enter this code:` : "";
    p.innerHTML = `Open this link in a browser if it did not open automatically: ${simpleLink(payload.url)}${codeHtml}`;
    container.replaceChildren(p);

    if (payload.code !== undefined) {
        const codeEl = document.createElement("code");
        codeEl.className = "cean-login-code";
        codeEl.textContent = payload.code;
        container.append(codeEl);
    }

    return container;
}

function createLoginResult(payload: ResLogin, onBack: () => void): HTMLDivElement {
    const container = document.createElement("div");

    if (payload.success) {
        container.className = "cean-login-result cean-success";
        container.textContent = "Logged in successfully";
    } else {
        container.className = "cean-login-result cean-error";
        container.textContent = `Login failed: ${payload.error}`;

        const backButton = iconTextButton(
            "chevron-left",
            "Back",
            onBack,
            "Back to instance selection",
        );
        container.append(backButton);
    }

    return container;
}

function registerLoginCall(
    comm: LoginComm,
    callback: (payload: ResLogin) => void,
): [(payload: ReqLogin) => void, () => void] {
    const key = crypto.randomUUID();
    const call = (payload: ReqLogin) => {
        comm.sendReqLogin(key, payload);
    };
    const cleanup = () => {
        comm.offResLogin(key);
    };
    comm.onResLogin(key, callback);
    return [call, cleanup];
}

type ReqLogin =
    | {
          instance_key: string;
      }
    | {
          apiUrl: string;
          token: string;
      };

type ResLogin = {
    success: boolean;
    error?: string;
};

type ReqOpenBrowser = {
    url: string;
    code?: string;
};

class LoginComm extends BackendComm {
    sendReqLogin(key: string, payload: ReqLogin) {
        this.send("req:login", key, payload);
    }

    onResLogin(key: string, callback: (payload: ResLogin) => void) {
        this.getForMethod("res:login").set(key, callback);
    }

    offResLogin(key: string) {
        this.getForMethod("res:login").delete(key);
    }

    onReqOpenBrowser(key: string, callback: (payload: ReqOpenBrowser) => void) {
        this.getForMethod("req:openBrowser").set(key, callback);
    }

    offReqOpenBrowser(key: string) {
        this.getForMethod("req:openBrowser").delete(key);
    }
}

export default { render };
