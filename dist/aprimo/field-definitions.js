const BASE_FIELD_KEYS = new Set([
    "id",
    "name",
    "label",
    "dataType",
    "isRequired",
    "isReadOnly",
    "isUniqueIdentifier",
    "indexed",
    "languageMode",
    "scope",
    "scopeCategory",
    "defaultValue",
    "validation",
    "validationTrigger",
    "validationErrorMessage",
    "storageMode",
    "helpText",
    "labels",
    "enabledLanguages",
    "memberships",
    "aiEnabled",
    "metadataPredictionEnabled",
    "searchIndexRebuildRequired",
    "sortIndex",
    "createdOn",
    "modifiedOn",
    "helpTexts",
    "inlineStyle",
    "resetToDefaultFields",
    "resetToDefaultTriggers",
    "tag",
    "hints",
]);
const GUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
function normalizeGuid(value) {
    return value.replace(/-/g, "").toLowerCase();
}
function isGuid(value) {
    return GUID_PATTERN.test(value.trim());
}
function asString(value) {
    return typeof value === "string" ? value : null;
}
function asBoolean(value) {
    return typeof value === "boolean" ? value : null;
}
function asNumber(value) {
    return typeof value === "number" ? value : null;
}
function mapFieldDefinition(raw) {
    const typeConfiguration = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!BASE_FIELD_KEYS.has(key) && !key.startsWith("_")) {
            typeConfiguration[key] = value;
        }
    }
    return {
        id: raw.id ?? "",
        name: raw.name ?? "",
        label: raw.label ?? "",
        dataType: asString(raw.dataType) ?? "Unknown",
        isRequired: raw.isRequired === true,
        isReadOnly: raw.isReadOnly === true,
        isUniqueIdentifier: raw.isUniqueIdentifier === true,
        indexed: raw.indexed === true,
        languageMode: asString(raw.languageMode),
        scope: asString(raw.scope),
        scopeCategory: asString(raw.scopeCategory),
        defaultValue: asString(raw.defaultValue),
        validation: asString(raw.validation),
        validationTrigger: asString(raw.validationTrigger),
        validationErrorMessage: asString(raw.validationErrorMessage),
        storageMode: asString(raw.storageMode),
        helpText: asString(raw.helpText),
        labels: (raw.labels ?? [])
            .filter((entry) => typeof entry.languageId === "string" &&
            typeof entry.value === "string")
            .map((entry) => ({
            languageId: entry.languageId,
            value: entry.value,
        })),
        enabledLanguages: Array.isArray(raw.enabledLanguages)
            ? raw.enabledLanguages.filter((value) => typeof value === "string")
            : [],
        memberships: Array.isArray(raw.memberships)
            ? raw.memberships.filter((value) => typeof value === "string")
            : [],
        aiEnabled: asBoolean(raw.aiEnabled),
        metadataPredictionEnabled: asBoolean(raw.metadataPredictionEnabled),
        searchIndexRebuildRequired: asBoolean(raw.searchIndexRebuildRequired),
        sortIndex: asNumber(raw.sortIndex),
        createdOn: asString(raw.createdOn),
        modifiedOn: asString(raw.modifiedOn),
        typeConfiguration,
    };
}
async function getFieldDefinitionById(client, id) {
    const normalizedId = normalizeGuid(id);
    const raw = await client.get(`/api/core/fielddefinition/${normalizedId}`);
    return mapFieldDefinition(raw);
}
async function listAllFieldDefinitions(client) {
    const all = [];
    let page = 1;
    const pageSize = 200;
    while (true) {
        const response = await client.get("/api/core/fielddefinitions", {
            page: String(page),
            pageSize: String(pageSize),
        });
        const items = response.items ?? [];
        all.push(...items);
        const totalCount = response.totalCount ?? all.length;
        if (items.length === 0 || all.length >= totalCount) {
            break;
        }
        page += 1;
    }
    return all;
}
function matchesLabel(field, query) {
    const normalizedQuery = query.toLocaleLowerCase();
    if (field.label?.toLocaleLowerCase() === normalizedQuery) {
        return true;
    }
    return (field.labels ?? []).some((entry) => entry.value?.toLocaleLowerCase() === normalizedQuery);
}
function findByName(fields, query) {
    const normalizedQuery = query.toLocaleLowerCase();
    return fields.filter((field) => field.name?.toLocaleLowerCase() === normalizedQuery);
}
function findByLabel(fields, query) {
    return fields.filter((field) => matchesLabel(field, query));
}
export async function searchFieldDefinitions(client, params) {
    const query = params.query.trim();
    if (!query) {
        throw new Error("Field definition query cannot be empty");
    }
    if (isGuid(query)) {
        const field = await getFieldDefinitionById(client, query);
        return {
            matchCount: 1,
            matchedBy: "id",
            fields: [field],
        };
    }
    const allFields = await listAllFieldDefinitions(client);
    const nameMatches = findByName(allFields, query);
    if (nameMatches.length > 0) {
        return {
            matchCount: nameMatches.length,
            matchedBy: "name",
            fields: nameMatches.map(mapFieldDefinition),
        };
    }
    const labelMatches = findByLabel(allFields, query);
    if (labelMatches.length > 0) {
        return {
            matchCount: labelMatches.length,
            matchedBy: "label",
            fields: labelMatches.map(mapFieldDefinition),
        };
    }
    throw new Error(`No field definition found matching "${query}" by name, label, or id`);
}
