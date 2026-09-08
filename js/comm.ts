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

export type ReqBuildField = {
    name: string;
    values: Record<string, any>;
    existingValue: any; // value of the field to build when the callback was called
};

export type ResBuildField = {
    value?: unknown;
    error?: string;
    existingValue: any; // value of the field to build when the callback was called
};

export type ReqUploadDataset = Record<string, any>;

export type ReqLoadImage = {
    path: string;
    caption?: string;
};

export type ResLoadImage = {
    path: string;
    caption?: string;
    image?: string;
    error?: string;
};

export type FieldError = {
    field: string;
    error: string;
};

export type UploadError = {
    message?: string;
    fieldErrors: FieldError[];
};

export type ResUploadDataset = {
    datasetName: string;
    pid?: string;
    datasetUrl?: string;
    error?: UploadError;
};

export class BackendComm {
    private readonly model: AnyModel<any>;
    private callbacks = new Map<string, Map<string, (payload: any) => void>>();

    constructor(model: AnyModel<any>) {
        this.model = model;

        this.model.on("msg:custom", (message: any) => {
            if (message.hasOwnProperty("type")) {
                const key = message["key"] as string;
                const callback = this.callbacks.get(message["type"])?.get(key);
                if (callback) {
                    callback(message["payload"]);
                }
                return;
            }
            console.warn(`Unknown message type: ${message}`);
        });
    }

    sendReqInspectFile(key: string, payload: ReqInspectFile) {
        this.model.send({ type: "req:inspect-file", key, payload });
    }

    onResInspectFile(key: string, callback: (payload: ResInspectFile) => void) {
        this.getForMethod("res:inspect-file").set(key, callback);
    }

    offResInspectFile(key: string) {
        this.getForMethod("res:inspect-file").delete(key);
    }

    sendReqBrowseFiles(key: string, payload: ReqBrowseFiles) {
        this.model.send({ type: "req:browse-files", key, payload });
    }

    onResBrowseFiles(key: string, callback: (payload: ResBrowseFiles) => void) {
        this.getForMethod("res:browse-files").set(key, callback);
    }

    offResBrowseFiles(key: string) {
        this.getForMethod("res:browse-files").delete(key);
    }

    sendReqBuildField(key: string, payload: ReqBuildField) {
        this.model.send({ type: "req:build-field", key, payload });
    }

    onResBuildField(key: string, callback: (payload: ResBuildField) => void) {
        this.getForMethod("res:build-field").set(key, callback);
    }

    offResBuildField(key: string) {
        this.getForMethod("res:build-field").delete(key);
    }

    sendReqUploadDataset(key: string, payload: ReqUploadDataset) {
        this.model.send({ type: "req:upload-dataset", key, payload });
    }

    onResUploadDataset(key: string, callback: (payload: ResUploadDataset) => void) {
        this.getForMethod("res:upload-dataset").set(key, callback);
    }

    sendReqLoadImage(key: string, payload: ReqLoadImage) {
        this.model.send({ type: "req:load-image", key, payload });
    }

    onResLoadImage(key: string, callback: (payload: ResLoadImage) => void) {
        this.getForMethod("res:load-image").set(key, callback);
    }

    offResLoadImage(key: string) {
        this.getForMethod("res:load-image").delete(key);
    }

    private getForMethod(method: string) {
        const map = this.callbacks.get(method);
        if (map !== undefined) {
            return map;
        }
        const newMap = new Map();
        this.callbacks.set(method, newMap);
        return newMap;
    }
}
