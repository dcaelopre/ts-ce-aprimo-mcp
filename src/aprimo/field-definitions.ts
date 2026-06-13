import type { AprimoClient } from "./client.js";

export interface SearchFieldDefinitionParams {
  query?: string;
  dataType?: string;
  page?: number;
  pageSize?: number;
}

export interface FieldDefinitionSummary {
  id: string;
  name: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  isReadOnly: boolean;
  isUniqueIdentifier: boolean;
  indexed: boolean;
  languageMode: string | null;
  scope: string | null;
  scopeCategory: string | null;
  defaultValue: string | null;
  validation: string | null;
  validationTrigger: string | null;
  validationErrorMessage: string | null;
  storageMode: string | null;
  helpText: string | null;
  labels: Array<{ languageId: string; value: string }>;
  enabledLanguages: string[];
  memberships: string[];
  aiEnabled: boolean | null;
  metadataPredictionEnabled: boolean | null;
  searchIndexRebuildRequired: boolean | null;
  sortIndex: number | null;
  createdOn: string | null;
  modifiedOn: string | null;
  typeConfiguration: Record<string, unknown>;
}

export interface SearchFieldDefinitionsResponse {
  matchCount: number;
  matchedBy: "id" | "name" | "label" | "dataType";
  dataType?: string;
  page?: number;
  pageSize?: number;
  fields: FieldDefinitionSummary[];
}

interface FieldDefinitionPage {
  items?: RawFieldDefinition[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  _links?: {
    next?: { href?: string };
  };
}

type RawFieldDefinition = Record<string, unknown> & {
  id?: string;
  name?: string;
  label?: string;
  labels?: Array<{ languageId?: string; value?: string }>;
};

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

const GUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function normalizeGuid(value: string): string {
  return value.replace(/-/g, "").toLowerCase();
}

function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value.trim());
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function mapFieldDefinition(raw: RawFieldDefinition): FieldDefinitionSummary {
  const typeConfiguration: Record<string, unknown> = {};

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
      .filter(
        (entry): entry is { languageId: string; value: string } =>
          typeof entry.languageId === "string" &&
          typeof entry.value === "string",
      )
      .map((entry) => ({
        languageId: entry.languageId,
        value: entry.value,
      })),
    enabledLanguages: Array.isArray(raw.enabledLanguages)
      ? raw.enabledLanguages.filter((value): value is string => typeof value === "string")
      : [],
    memberships: Array.isArray(raw.memberships)
      ? raw.memberships.filter((value): value is string => typeof value === "string")
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

async function getFieldDefinitionById(
  client: AprimoClient,
  id: string,
): Promise<FieldDefinitionSummary> {
  const normalizedId = normalizeGuid(id);
  const raw = await client.get<RawFieldDefinition>(
    `/api/core/fielddefinition/${normalizedId}`,
  );

  return mapFieldDefinition(raw);
}

async function listAllFieldDefinitions(
  client: AprimoClient,
): Promise<RawFieldDefinition[]> {
  const all: RawFieldDefinition[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await client.get<FieldDefinitionPage>(
      "/api/core/fielddefinitions",
      {
        page: String(page),
        pageSize: String(pageSize),
      },
    );

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

function matchesLabel(field: RawFieldDefinition, query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase();

  if (field.label?.toLocaleLowerCase() === normalizedQuery) {
    return true;
  }

  return (field.labels ?? []).some(
    (entry) => entry.value?.toLocaleLowerCase() === normalizedQuery,
  );
}

function findByName(
  fields: RawFieldDefinition[],
  query: string,
): RawFieldDefinition[] {
  const normalizedQuery = query.toLocaleLowerCase();
  return fields.filter(
    (field) => field.name?.toLocaleLowerCase() === normalizedQuery,
  );
}

function findByLabel(
  fields: RawFieldDefinition[],
  query: string,
): RawFieldDefinition[] {
  return fields.filter((field) => matchesLabel(field, query));
}

function normalizeDataType(value: string): string {
  return value.replace(/[\s_-]+/g, "").toLowerCase();
}

function matchesDataType(field: RawFieldDefinition, dataType: string): boolean {
  const fieldDataType = asString(field.dataType);
  if (!fieldDataType) {
    return false;
  }

  return normalizeDataType(fieldDataType) === normalizeDataType(dataType);
}

function findByDataType(
  fields: RawFieldDefinition[],
  dataType: string,
): RawFieldDefinition[] {
  return fields.filter((field) => matchesDataType(field, dataType));
}

function paginateFields<T>(
  fields: T[],
  page?: number,
  pageSize?: number,
): { items: T[]; page: number; pageSize: number } {
  const resolvedPage = page ?? 1;
  const resolvedPageSize = pageSize ?? 25;
  const start = (resolvedPage - 1) * resolvedPageSize;

  return {
    items: fields.slice(start, start + resolvedPageSize),
    page: resolvedPage,
    pageSize: resolvedPageSize,
  };
}

function buildListResponse(
  fields: RawFieldDefinition[],
  matchedBy: SearchFieldDefinitionsResponse["matchedBy"],
  options?: {
    dataType?: string;
    page?: number;
    pageSize?: number;
  },
): SearchFieldDefinitionsResponse {
  const paginated = paginateFields(fields, options?.page, options?.pageSize);

  return {
    matchCount: fields.length,
    matchedBy,
    ...(options?.dataType ? { dataType: options.dataType } : {}),
    page: paginated.page,
    pageSize: paginated.pageSize,
    fields: paginated.items.map(mapFieldDefinition),
  };
}

export async function searchFieldDefinitions(
  client: AprimoClient,
  params: SearchFieldDefinitionParams,
): Promise<SearchFieldDefinitionsResponse> {
  const query = params.query?.trim();
  const dataType = params.dataType?.trim();

  if (!query && !dataType) {
    throw new Error("Provide a query (GUID, name, or label) and/or a dataType");
  }

  if (query && isGuid(query)) {
    const field = await getFieldDefinitionById(client, query);

    if (
      dataType &&
      normalizeDataType(field.dataType) !== normalizeDataType(dataType)
    ) {
      throw new Error(
        `Field "${field.name}" has data type "${field.dataType}", not "${dataType}"`,
      );
    }

    return {
      matchCount: 1,
      matchedBy: "id",
      ...(dataType ? { dataType } : {}),
      fields: [field],
    };
  }

  const allFields = await listAllFieldDefinitions(client);

  if (query) {
    const nameMatches = findByName(allFields, query);
    if (nameMatches.length > 0) {
      const filtered = dataType
        ? findByDataType(nameMatches, dataType)
        : nameMatches;

      if (filtered.length === 0) {
        throw new Error(
          `Found field "${query}" by name, but none with data type "${dataType}"`,
        );
      }

      return buildListResponse(filtered, "name", {
        dataType,
        page: params.page,
        pageSize: params.pageSize,
      });
    }

    const labelMatches = findByLabel(allFields, query);
    if (labelMatches.length > 0) {
      const filtered = dataType
        ? findByDataType(labelMatches, dataType)
        : labelMatches;

      if (filtered.length === 0) {
        throw new Error(
          `Found field "${query}" by label, but none with data type "${dataType}"`,
        );
      }

      return buildListResponse(filtered, "label", {
        dataType,
        page: params.page,
        pageSize: params.pageSize,
      });
    }

    throw new Error(
      `No field definition found matching "${query}" by name, label, or id`,
    );
  }

  const dataTypeMatches = findByDataType(allFields, dataType!);
  if (dataTypeMatches.length === 0) {
    throw new Error(`No field definitions found with data type "${dataType}"`);
  }

  return buildListResponse(dataTypeMatches, "dataType", {
    dataType,
    page: params.page,
    pageSize: params.pageSize,
  });
}
