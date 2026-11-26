import type { AnyModel, RenderProps } from "@anywidget/types";
import "./datasetUploadWidget.css";
import { Config, StaticData } from "./models.ts";
import { BackendComm } from "./comm.ts";
import { InputComponent } from "./components/input";
import { DatasetOverview } from "./forms";
import { GatherResult, UploadComponent } from "./components";
import { connectInputs } from "./fieldAutomation.ts";
import { createInputs } from "./inputConstruction.ts";

interface WidgetModel {
    config: Config;
    initial: object;
    staticData: StaticData;
}

async function render({ model, el }: RenderProps<WidgetModel>) {
    const config = model.get("config");
    const staticData = parseStaticData(model);

    const comm = new DatasetUploadComm(model);

    const inputs = createInputs(config, staticData, comm);
    const inputConnectionCleanup = connectInputs(
        inputs,
        staticData,
        config.fieldDependencies,
        comm,
        new Set(config.lockedFields),
    );

    const uploader = new UploadComponent(comm, config, () => {
        return gatherData(inputs);
    });

    const datasetOverview = new DatasetOverview(inputs, uploader, config);
    el.appendChild(datasetOverview.element);

    el.addEventListener(
        "keydown",
        (e) => {
            if (e.key === "Enter" && e.shiftKey) {
                // Make sure that shift+enter does not re-run the notebook cell.
                e.stopPropagation();
                e.preventDefault();
            }
        },
        true,
    );

    setInitialData(inputs, model.get("initial"));
    disableEditing(inputs, [...config.lockedFields, ...config.nonEditableFields]);

    return () => {
        datasetOverview.destroy();
        for (const input of inputs.values()) {
            input.destroy();
        }
        inputConnectionCleanup();
        comm.destroy();
    };
}

function parseStaticData(model: AnyModel<any>): StaticData {
    const staticData = model.get("staticData");
    for (const proposal of staticData.proposals) {
        proposal.startTime = new Date(proposal.startTime);
    }
    return staticData;
}

function setInitialData(
    inputs: Map<string, InputComponent<any>>,
    initialData: Record<string, any>,
) {
    for (const [key, value] of Object.entries(initialData)) {
        // userTriggered=true so that the fields written here are not overridden by update-handlers
        inputs.get(key)?.setSignaling(value, true);
    }
}

function disableEditing(inputs: Map<string, InputComponent<any>>, fields: string[]) {
    for (const name of fields) {
        const input = inputs.get(name);
        if (input === undefined) {
            console.warn(
                `Cannot disable editing of field '${name}', field does not exist`,
            );
        } else {
            input.disableEditing();
        }
    }
}

function gatherData(inputs: Map<string, InputComponent<any>>): GatherResult {
    const data: Record<string, any> = {};
    let validationErrors = false; // TODO
    for (const [key, input] of inputs.entries()) {
        const value = input.value;
        if (value !== null) data[key] = value;
    }
    return { data, validationErrors };
}

type ReqBuildField = {
    name: string;
    values: Record<string, any>;
    requestId: number; // echoed back in the response
};

export type ResBuildField = {
    value?: unknown;
    error?: string;
    requestId: number; // id of the request that this is a response to
};

type ReqUploadDataset = Record<string, any>;

type FieldError = {
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

export class DatasetUploadComm extends BackendComm {
    sendReqBuildField(key: string, payload: ReqBuildField) {
        this.send("req:build-field", key, payload);
    }

    onResBuildField(key: string, callback: (payload: ResBuildField) => void) {
        this.getForMethod("res:build-field").set(key, callback);
    }

    offResBuildField(key: string) {
        this.getForMethod("res:build-field").delete(key);
    }

    sendReqUploadDataset(key: string, payload: ReqUploadDataset) {
        this.send("req:upload-dataset", key, payload);
    }

    onResUploadDataset(key: string, callback: (payload: ResUploadDataset) => void) {
        this.getForMethod("res:upload-dataset").set(key, callback);
    }
}

export default { render };
