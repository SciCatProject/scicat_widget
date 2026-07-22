import type { AnyModel, RenderProps } from "@anywidget/types";
import "./datasetUploadWidget.css";
import { Config, StaticData } from "./models.ts";
import { BackendComm } from "./comm.ts";
import { InputComponent } from "./components/input";
import { DatasetOverview, SignIn } from "./forms";
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

    const comm = new BackendComm(model);

    const signIn = new SignIn();
    el.appendChild(signIn.element);

    return;

    const inputs = createInputs(config, staticData, comm);
    const inputConnectionCleanup = connectInputs(
        inputs,
        staticData,
        config.fieldDependencies,
        comm,
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

    // lockFields must be after setInitialData to set the data before locks take effect.
    setInitialData(inputs, model.get("initial"));
    lockFields(inputs, config.lockedFields);

    return () => {
        datasetOverview.destroy();
        for (const input of inputs.values()) {
            input.destroy();
        }
        inputConnectionCleanup();
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

function lockFields(inputs: Map<string, InputComponent<any>>, lockedFields: string[]) {
    for (const name of lockedFields) {
        const input = inputs.get(name);
        if (input === undefined) {
            console.warn(`Cannot lock field '${name}', field does not exist`);
        } else {
            input.lock();
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

export default { render };
