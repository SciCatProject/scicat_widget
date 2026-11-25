import {
    ComboboxInput,
    ComboboxManualInput,
    DatetimeInput,
    InputComponent,
    MultiAttachmentInput,
    MultiFileInput,
    MultiInput,
    PeopleInput,
    RadioInput,
    ScientificMetadataInput,
    TextInput,
} from "./components/input";
import { Options as TextInputOptions } from "./components/input/textInput.ts";
import { Choice } from "./components/input/comboboxInput.ts";
import {
    Config,
    Instrument,
    Proposal,
    StaticData,
    Technique,
    Techniques,
} from "./models.ts";
import { BackendComm } from "./comm.ts";
import { createIcon } from "./components";

export function createInputs(
    config: Config,
    staticData: StaticData,
    comm: BackendComm,
): Map<string, InputComponent<unknown>> {
    const inputList = [
        new TextInput("datasetName", { required: true }),
        new TextInput("description", { multiline: true }),
        makeProposalInput(
            staticData.proposals,
            staticData.instruments,
            config.frontendUrl,
        ),
        makeInstrumentInput(staticData.instruments, config.frontendUrl),
        new TextInput("creationLocation", {}),
        new TextInput("runNumber", {}),
        new DatetimeInput("startTime", {}),
        new DatetimeInput("endTime", {}),
        makeMultiTextInput("principalInvestigators", true),
        makeMultiTextInput("contactEmails", true, { type: "email" }),
        new PeopleInput("owners", {}),
        makeOwnerGroupInput(staticData.accessGroups),
        makeMultiTextInput("accessGroups"),
        new TextInput("license", {}),
        makeTechniquesInput(staticData.techniques),
        makeMultiTextInput("usedSoftware"),
        makeMultiTextInput("sampleIds"),
        makeDatasetTypeInput(),
        makeMultiTextInput("keywords"),
        makeMultiTextInput("inputDatasets"),
        new ScientificMetadataInput("scientificMetadata", {
            schema: config.scientificMetadataSchema,
        }),
        new TextInput("sourceFolder", { required: true }),
        new MultiFileInput("files", comm, {}),
        new MultiAttachmentInput("attachments", comm, {}),
    ];

    const inputs = new Map();
    for (const input of inputList) {
        inputs.set(input.key, input);
    }
    return inputs;
}

function makeMultiTextInput(
    key: string,
    required: boolean = false,
    textOptions: TextInputOptions = {},
): MultiInput {
    const renderItem = (value: string) => {
        const textSpan = document.createElement("span");
        textSpan.className = "cean-item-text";
        textSpan.textContent = value;

        const wrap = document.createElement("div");
        wrap.append(textSpan);
        return wrap;
    };
    return new MultiInput(key, new TextInput(`${key}-input`, textOptions), renderItem, {
        compressedItems: true,
        addButton: true,
        required,
    });
}

function makeDatasetTypeInput(): RadioInput {
    return new RadioInput("type", {
        required: true,
        choices: [
            {
                value: "raw",
                display: "Raw",
                description:
                    "A dataset without predecessors (in the same SciCat catalogue)",
            },
            {
                value: "derived",
                display: "Derived",
                description:
                    "A dataset with predecessors (specify in 'Input datasets')",
            },
        ],
        initial: "raw",
    });
}

function makeProposalInput(
    proposals: Proposal[],
    instruments: Instrument[],
    scicatUrl: string | null,
): MultiInput {
    const proposalMap = new Map(
        proposals.map((proposal) => {
            return [proposal.id, proposal];
        }),
    );

    const choices =
        proposals
            .map((proposal) => {
                return { key: proposal.id, text: proposal.title };
            })
            .sort(
                (a, b) =>
                    proposalMap.get(b.key)!.startTime.getTime() -
                    proposalMap.get(a.key)!.startTime.getTime(),
            ) ?? [];

    function renderItem(value: string): HTMLElement | HTMLElement[] {
        const proposal = proposalMap.get(value);
        if (proposal !== undefined) {
            const content = renderKnownProposalItem(proposal, instruments);
            if (scicatUrl) {
                const anchor = makeExternalLink(
                    `${scicatUrl}/proposals/${encodeURIComponent(proposal.id)}`,
                );
                return [content, anchor];
            }
            return content;
        }
        return renderUnknownItem(value);
    }

    function renderChoice(choice: Choice): HTMLElement {
        const proposal = proposalMap.get(choice.key);
        if (proposal !== undefined) {
            return renderKnownProposalItem(proposal, instruments);
        }
        return renderUnknownItem(choice.key);
    }

    const combobox = new ComboboxManualInput("proposalIds-input", choices, {
        fieldName: "proposal IDs",
        renderChoice,
    });
    return new MultiInput("proposalIds", combobox, renderItem, {});
}

function renderKnownProposalItem(
    proposal: Proposal,
    instruments: Instrument[],
): HTMLElement {
    const keySpan = document.createElement("span");
    keySpan.className = "cean-item-primary cean-item-key";
    keySpan.textContent = proposal.id;

    const textSpan = document.createElement("span");
    textSpan.className = "cean-item-text";
    textSpan.textContent = proposal.title;

    const mainRow = document.createElement("div");
    mainRow.className = "cean-item-row";
    mainRow.append(keySpan, textSpan);

    const detailsRow = document.createElement("div");
    detailsRow.className = "cean-item-row cean-item-detail-row";

    const dateSpan = document.createElement("span");
    dateSpan.textContent = formatDate(proposal.startTime);
    dateSpan.title = proposal.startTime.toISOString();
    detailsRow.append(dateSpan);

    const instrumentsSpan = document.createElement("span");
    for (const instrumentId of proposal.instrumentIds) {
        const span = document.createElement("span");
        span.textContent = findById(instrumentId, instruments)?.name ?? "?";
        instrumentsSpan.append(span);
    }
    if (instrumentsSpan.children.length > 0) {
        detailsRow.append(makeDetailsSeparator(), instrumentsSpan);
    }

    const typeSpan = makeProposalTypeSpan(proposal);
    if (typeSpan !== null) detailsRow.append(makeDetailsSeparator(), typeSpan);

    const wrap = document.createElement("div");
    wrap.className = "cean-proposal";
    wrap.append(mainRow, detailsRow);
    return wrap;
}

function makeProposalTypeSpan(proposal: Proposal): HTMLSpanElement | null {
    const type = proposal.type?.toLowerCase();
    if (type === undefined) return null;
    if (type === "default" || type == "default proposal" || type == "proposal default")
        return null;

    const span = document.createElement("span");
    span.textContent = type;
    return span;
}

function makeInstrumentInput(
    instruments: Instrument[],
    scicatUrl: string | null,
): MultiInput {
    const instrumentMap = new Map(
        instruments.map((instrument) => {
            return [instrument.id, instrument];
        }),
    );

    const choices = instruments
        .map((instrument) => {
            return {
                key: instrument.id,
                text: instrument.name,
            };
        })
        .sort((a, b) => a.text.localeCompare(b.text));

    function renderItem(value: string): HTMLElement | HTMLElement[] {
        const instrument = instrumentMap.get(value);
        if (instrument !== undefined) {
            const content = renderKnownInstrumentItem(instrument);
            if (scicatUrl) {
                const anchor = makeExternalLink(
                    `${scicatUrl}/instruments/${encodeURIComponent(instrument.id)}`,
                );
                return [content, anchor];
            }
            return content;
        }
        return renderUnknownItem(value);
    }

    function renderChoice(choice: Choice): HTMLElement {
        const instrument = instrumentMap.get(choice.key);
        if (instrument !== undefined) {
            return renderKnownInstrumentItem(instrument);
        }
        return renderUnknownItem(choice.text);
    }

    const combobox = new ComboboxManualInput("instrumentIds-input", choices, {
        fieldName: "instrument IDs",
        renderChoice,
    });
    return new MultiInput("instrumentIds", combobox, renderItem, {});
}

function renderKnownInstrumentItem(instrument: Instrument): HTMLElement {
    const nameSpan = document.createElement("span");
    nameSpan.className = "cean-item-primary";
    nameSpan.textContent = instrument.name;

    const uniqueNameSpan = document.createElement("span");
    uniqueNameSpan.className = "cean-item-key";
    uniqueNameSpan.textContent = `(${instrument.uniqueName})`;

    const mainRow = document.createElement("div");
    mainRow.className = "cean-item-row";
    mainRow.append(nameSpan, uniqueNameSpan);

    const idSpan = document.createElement("span");
    idSpan.className = "cean-item-key";
    idSpan.textContent = instrument.id;

    const detailsRow = document.createElement("div");
    detailsRow.className = "cean-item-row cean-item-detail-row";
    detailsRow.append(idSpan);

    const wrap = document.createElement("div");
    wrap.className = "cean-instrument";
    wrap.append(mainRow, detailsRow);
    return wrap;
}

function makeOwnerGroupInput(accessGroups: string[]): ComboboxInput | TextInput {
    if (accessGroups.length == 0) {
        return new TextInput("ownerGroup", { required: true });
    } else {
        const choices =
            accessGroups
                .map((group) => {
                    return { key: group, text: group };
                })
                .sort((a, b) => a.key.localeCompare(b.key)) ?? [];

        const renderChoice = (choice: Choice) => {
            const el = document.createElement("span");
            el.className = "cean-item-text";
            el.textContent = choice.text;
            return el;
        };

        return new ComboboxInput("ownerGroup", choices, {
            required: true,
            renderChoice,
        });
    }
}

function makeTechniquesInput(techniques: Techniques): MultiInput {
    const choices = techniques.techniques
        .map((technique) => {
            return { key: technique.id, text: technique.name };
        })
        .sort((a, b) => a.key.localeCompare(b.key));
    const combobox = new ComboboxManualInput("techniques-choices", choices, {
        fieldName: "technique",
    });

    const renderItem = (value: string): HTMLElement => {
        for (const technique of techniques.techniques) {
            if (technique.id == value) {
                return renderKnownTechniqueItem(technique, techniques.prefix);
            }
        }
        return renderUnknownItem(value);
    };

    return new MultiInput("techniques", combobox, renderItem, {});
}

function renderKnownTechniqueItem(
    technique: Technique,
    urlPrefix: string,
): HTMLElement {
    const keySpan = document.createElement("span");
    keySpan.className = "cean-item-key";
    keySpan.textContent = technique.id;

    const textSpan = document.createElement("span");
    textSpan.className = "cean-item-text";
    textSpan.textContent = technique.name;

    const anchor = makeExternalLink(`${urlPrefix}/${technique.id}`);

    const wrap = document.createElement("div");
    wrap.className = "cean-item-row";
    wrap.append(keySpan, textSpan, anchor);
    return wrap;
}

function renderUnknownItem(value: string): HTMLElement {
    const textSpan = document.createElement("span");
    textSpan.className = "cean-item-text";
    textSpan.textContent = value;

    const wrap = document.createElement("div");
    wrap.className = "cean-item-row";
    wrap.append(textSpan);
    return wrap;
}

function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
}

function makeDetailsSeparator(): HTMLSpanElement {
    const span = document.createElement("span");
    span.innerHTML = "&#8226";
    return span;
}

function findById<T extends { id: string }>(id: string, items: T[]): T | null {
    for (const item of items) {
        if (item.id == id) return item;
    }
    return null;
}

function makeExternalLink(url: string): HTMLAnchorElement {
    const anchor = document.createElement("a");
    anchor.className = "cean-external-link";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.tabIndex = -1;
    anchor.append(createIcon("external-link-alt"));
    return anchor;
}
