import { InputComponent, UpdateEvent } from "./components/input";
import { StaticData } from "./models.ts";
import { DatasetUploadComm, ResBuildField } from "./datasetUploadWidget.ts";

/**
 * Connect input fields to automatically set values based on changes.
 * @param inputs Inputs keyed by SciCat key.
 * @param staticData Unchanging data to extract information from.
 * @param fieldConnections User-declared relationships between fields.
 * @param comm Communication interface for backend interactions.
 * @param lockedFields Fields that must never be changed automatically.
 *                     They can still be used as sources for other fields.
 * @returns Function to clean up the comm interface.
 */
export function connectInputs(
    inputs: Map<string, InputComponent<any>>,
    staticData: StaticData,
    fieldConnections: Record<string, string[]>,
    comm: DatasetUploadComm,
    lockedFields: Set<string>,
): () => void {
    connectHardCoded(inputs, lockedFields, staticData);
    return connectUserDefined(inputs, lockedFields, staticData, fieldConnections, comm);
}

function connectHardCoded(
    inputs: Map<string, InputComponent<any>>,
    lockedFields: Set<string>,
    staticData: StaticData,
) {
    connectInputPair(
        inputs,
        lockedFields,
        "instrumentIds",
        "proposalIds",
        (destination: InputComponent<string[]>, proposalIds: string[] | null) => {
            const instrumentIds = extractFieldsForIds(
                staticData.proposals,
                proposalIds,
                "instrumentIds",
            );
            if (instrumentIds) {
                destination.setSignaling(instrumentIds.flat(), false);
            } else {
                destination.setSignaling(null, false);
            }
        },
    );

    connectInputPair(
        inputs,
        lockedFields,
        "principalInvestigators",
        "proposalIds",
        (destination: InputComponent<string[]>, proposalIds: string[] | null) => {
            const names = extractFieldsForIds(
                staticData.proposals,
                proposalIds,
                "piName",
            );
            if (names) {
                destination.setSignaling(names, false);
            } else {
                destination.setSignaling(null, false);
            }
        },
    );

    connectInputPair(
        inputs,
        lockedFields,
        "contactEmails",
        "proposalIds",
        (destination: InputComponent<string[]>, proposalIds: string[] | null) => {
            const emails = extractFieldsForIds(
                staticData.proposals,
                proposalIds,
                "piEmail",
            );
            if (emails) {
                destination.setSignaling(emails, false);
            } else {
                destination.setSignaling(null, false);
            }
        },
    );

    connectInputPair(
        inputs,
        lockedFields,
        "type",
        "inputDatasets",
        (datasetType: InputComponent<string>, inputDatasets: string[] | null) => {
            if (inputDatasets === null || inputDatasets.length == 0) {
                datasetType.setSignaling("raw", false);
            } else {
                datasetType.setSignaling("derived", false);
            }
        },
    );
}

function connectUserDefined(
    inputs: Map<string, InputComponent<any>>,
    lockedFields: Set<string>,
    staticData: StaticData,
    fieldConnections: Record<string, string[]>,
    comm: DatasetUploadComm,
): () => void {
    const responderKeys: string[] = [];
    for (const [targetName, dependencies] of Object.entries(fieldConnections)) {
        if (lockedFields.has(targetName)) continue;
        const key = connectInputsForTarget(
            inputs,
            targetName,
            dependencies,
            staticData,
            comm,
        );
        if (key !== null) {
            responderKeys.push(key);
        }
    }
    return () => {
        responderKeys.forEach((key) => {
            comm.offResBuildField(key);
        });
    };
}

type Source = {
    /** The user-requested name. */
    requestedName: string;
    /** The name of the underlying field. */
    underlyingName: string;
    getter: (input: InputComponent<any>) => any;
};

function makeSource(requestedName: string, staticData: StaticData): Source {
    switch (requestedName) {
        case "instrumentNames":
            return makeInstrumentNamesSource(staticData);
        default:
            return {
                requestedName,
                underlyingName: requestedName,
                getter: (input) => {
                    return input.value;
                },
            };
    }
}

function makeInstrumentNamesSource(staticData: StaticData): Source {
    return {
        requestedName: "instrumentNames",
        underlyingName: "instrumentIds",
        getter: (input: InputComponent<string[]>): string[] | null => {
            return (
                extractFieldsForIds(staticData.instruments, input.value, "name") ?? null
            );
        },
    };
}

function makeSources(
    inputs: Map<string, InputComponent<any>>,
    sourceNames: string[],
    staticData: StaticData,
): [Source, InputComponent<any>][] | null {
    const sources: [Source, InputComponent<any>][] = [];
    for (const sourceName of sourceNames) {
        const source = makeSource(sourceName, staticData);
        const input = inputs.get(source.underlyingName);
        if (input === undefined) {
            console.warn(
                `Cannot connect inputs, dependency not found: '${source.underlyingName}'`,
            );
            return null;
        }
        sources.push([source, input]);
    }
    return sources;
}

function connectInputsForTarget(
    inputs: Map<string, InputComponent<any>>,
    targetName: string,
    dependencies: string[],
    staticData: StaticData,
    comm: DatasetUploadComm,
): string | null {
    const target = inputs.get(targetName);
    if (target === undefined) {
        console.warn(`Cannot connect inputs, target not found: '${targetName}'`);
        return null;
    }

    const sources = makeSources(inputs, dependencies, staticData);
    if (sources === null) {
        return null;
    }

    const key = crypto.randomUUID();
    // Requests are answered asynchronously and may arrive after newer requests
    // have been sent. Only the response to the latest request is applied.
    let latestRequestId = 0;
    // Once the user (or the initial data) has set a value, it takes precedence over
    // automatic updates, including responses to requests that are still in flight.
    let setByUser = false;
    target.container.addEventListener("input-updated", ((event: UpdateEvent) => {
        if (event.userTriggered) setByUser = true;
    }) as EventListener);

    const responder = (payload: ResBuildField) => {
        if (payload.error !== undefined) {
            console.error(`Failed to build field ${targetName}: ${payload.error}`);
        } else if (payload.requestId === latestRequestId && !setByUser) {
            target.setSignaling(payload.value, false);
        }
    };
    comm.onResBuildField(key, responder);

    for (const [_, emitter] of sources) {
        target.listenToInput(emitter, () => {
            // Invalidate any requests that are still in flight.
            latestRequestId += 1;

            const values: Record<string, any> = {};
            for (const [source, valueInput] of sources) {
                const value = source.getter(valueInput);
                if (value === null) {
                    // not enough values to build
                    target.setSignaling(null, false);
                    return;
                }
                values[source.requestedName] = value;
            }
            comm.sendReqBuildField(key, {
                name: targetName,
                values,
                requestId: latestRequestId,
            });
        });
    }

    return key;
}

function connectInputPair<Dst, Src>(
    inputs: Map<string, InputComponent<any>>,
    lockedFields: Set<string>,
    target: string,
    source: string,
    listener: (dst: InputComponent<Dst>, value: Src | null) => void,
) {
    if (lockedFields.has(target)) return;
    const src = inputs.get(source);
    if (src === undefined) return;
    inputs.get(target)?.listenToInput(src, listener);
}

function extractFieldsForIds<T extends { id: string }, K extends keyof T>(
    collection: T[],
    ids: string[] | null,
    key: K,
): string[] | undefined {
    return ids
        ?.map((id: string) => {
            const found = collection.find((item) => {
                return item.id == id;
            });
            if (found === undefined) {
                return undefined;
            }
            return found[key];
        })
        .filter((name) => !!name) as string[] | undefined;
}
