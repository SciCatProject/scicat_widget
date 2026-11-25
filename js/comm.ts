import { AnyModel } from "@anywidget/types";
import { FileType } from "./components/icon.ts";

export type ReqInspectFile = {
    filename: string;
};

export type ResInspectFile = {
    success: boolean;
    filename: string;
    type: FileType;
    size?: number;
    creationTime?: string;
    remotePath?: string;
    error?: string;
};

export type ReqBrowseFiles = {};

export type ResBrowseFiles = {
    selected: string;
};

export type ReqLoadAttachment = {
    path: string;
    caption?: string;
};

export type ResLoadAttachment = {
    path: string;
    type: FileType;
    caption?: string;
    data?: string;
    error?: string;
};

export class BackendComm {
    private readonly model: AnyModel<any>;
    private callbacks = new Map<string, Map<string, (payload: any) => void>>();
    private readonly handler: (message: any) => void;

    constructor(model: AnyModel<any>) {
        this.model = model;

        this.handler = (message: any) => {
            if (message.hasOwnProperty("type")) {
                const key = message["key"] as string;
                const callback = this.callbacks.get(message["type"])?.get(key);
                if (callback) {
                    callback(message["payload"]);
                }
                return;
            }
            console.warn(`Unknown message type: ${message}`);
        };
        this.model.on("msg:custom", this.handler);
    }

    destroy() {
        this.model.off("msg:custom", this.handler);
    }

    sendReqInspectFile(key: string, payload: ReqInspectFile) {
        this.send("req:inspect-file", key, payload);
    }

    onResInspectFile(key: string, callback: (payload: ResInspectFile) => void) {
        this.getForMethod("res:inspect-file").set(key, callback);
    }

    offResInspectFile(key: string) {
        this.getForMethod("res:inspect-file").delete(key);
    }

    sendReqBrowseFiles(key: string, payload: ReqBrowseFiles) {
        this.send("req:browse-files", key, payload);
    }

    onResBrowseFiles(key: string, callback: (payload: ResBrowseFiles) => void) {
        this.getForMethod("res:browse-files").set(key, callback);
    }

    offResBrowseFiles(key: string) {
        this.getForMethod("res:browse-files").delete(key);
    }

    sendReqLoadAttachment(key: string, payload: ReqLoadAttachment) {
        this.send("req:load-attachment", key, payload);
    }

    onResLoadAttachment(key: string, callback: (payload: ResLoadAttachment) => void) {
        this.getForMethod("res:load-attachment").set(key, callback);
    }

    offResLoadAttachment(key: string) {
        this.getForMethod("res:load-attachment").delete(key);
    }

    protected send(type: string, key: string, payload: Record<string, any>) {
        this.model.send({ type, key, payload });
    }

    protected getForMethod(method: string) {
        const map = this.callbacks.get(method);
        if (map !== undefined) {
            return map;
        }
        const newMap = new Map();
        this.callbacks.set(method, newMap);
        return newMap;
    }
}
