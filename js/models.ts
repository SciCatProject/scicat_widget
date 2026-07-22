import { FileType } from "./components/icon.ts";

export type Attachment = {
    data: string;
    caption: string;
};

export type Config = {
    frontendUrl: string | null;
    scientificMetadataSchema: "plain" | "value-unit";
    fieldDependencies: Record<string, string[]>;
    lockedFields: string[];
    skipConfirmation: boolean;
};

export type File = {
    localPath: string;
    type: FileType;
    size?: number;
    remotePath?: string;
};

export type Instance = {
    name: string;
    url: string;
    supportsSSO: boolean;
};

export type Instrument = {
    id: string;
    name: string;
    uniqueName: string;
};

export type Person = {
    name: string;
    email?: string;
    orcid?: string;
};

export type Proposal = {
    id: string;
    title: string;
    startTime: Date;
    instrumentIds: string[];
    piName: string | null;
    piEmail: string | null;
    type: string | null;
};

export type StaticData = {
    instruments: Instrument[];
    proposals: Proposal[];
    accessGroups: string[];
    techniques: Techniques;
};

export type Technique = {
    id: string;
    name: string;
};

export type Techniques = {
    prefix: string;
    techniques: Technique[];
};
