import type { AprimoClient } from "./client.js";
import {
  RECORD_FIELDS_HEADERS,
  RECORD_SUMMARY_HEADERS,
  RECORD_WITH_METADATA_HEADERS,
} from "./headers.js";

export interface RecordFieldValue {
  fieldQuery: string;
  fieldId: string | null;
  fieldName: string | null;
  label: string | null;
  dataType: string | null;
  found: boolean;
  values: string[];
  valuesByLanguage: Array<{ languageId: string; values: string[] }>;
}

type RawRecordField = Record<string, unknown> & {
  id?: string;
  fieldName?: string;
  label?: string;
  dataType?: string;
  localizedValues?: Array<Record<string, unknown>>;
};

interface HalLink {
  href?: string;
}

interface HalRecordWithFields {
  id?: string;
  title?: string | null;
  status?: string | null;
  contentType?: string | null;
  createdOn?: string | null;
  modifiedOn?: string | null;
  thumbnail?: { uri?: string; href?: string };
  _links?: {
    thumbnail?: HalLink;
  };
  _embedded?: {
    fields?:
      | RawRecordField[]
      | {
          items?: RawRecordField[];
        };
  };
}

export interface RecordWithMetadata {
  id: string;
  title: string | null;
  status: string | null;
  contentType: string | null;
  createdOn: string | null;
  modifiedOn: string | null;
  thumbnailUrl: string | null;
  metadata: RecordFieldValue[];
}

const GUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

const RECORD_ID_PATTERN = /^[0-9a-f]{32}$/i;

export function normalizeGuid(value: string): string {
  return value.replace(/-/g, "").toLowerCase();
}

export function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value.trim());
}

export function isRecordId(value: string): boolean {
  const trimmed = value.trim();
  return RECORD_ID_PATTERN.test(trimmed) || isGuid(trimmed);
}

function extractThumbnailUrl(record: HalRecordWithFields): string | null {
  return (
    record.thumbnail?.uri ??
    record.thumbnail?.href ??
    record._links?.thumbnail?.href ??
    null
  );
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function fieldMatchesQuery(field: RawRecordField, query: string): boolean {
  const normalizedQuery = normalizeText(query);

  if (isGuid(query)) {
    return normalizeGuid(field.id ?? "") === normalizeGuid(query);
  }

  if (normalizeText(field.fieldName ?? "") === normalizedQuery) {
    return true;
  }

  if (normalizeText(field.label ?? "") === normalizedQuery) {
    return true;
  }

  const fieldName = normalizeText(field.fieldName ?? "");
  const label = normalizeText(field.label ?? "");

  return (
    (fieldName.length > 0 && fieldName.includes(normalizedQuery)) ||
    (label.length > 0 && label.includes(normalizedQuery))
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractLocalizedEntryValues(entry: Record<string, unknown>): string[] {
  const directValue = entry.value;
  if (typeof directValue === "string" && directValue.length > 0) {
    return [directValue];
  }

  if (typeof directValue === "number" && Number.isFinite(directValue)) {
    return [String(directValue)];
  }

  if (typeof directValue === "boolean") {
    return [String(directValue)];
  }

  const listValues = entry.values;
  if (Array.isArray(listValues)) {
    return listValues
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return (
            asString(record.title) ??
            asString(record.name) ??
            asString(record.label) ??
            asString(record.id) ??
            asString(record.value)
          );
        }

        return null;
      })
      .filter((value): value is string => typeof value === "string" && value.length > 0);
  }

  const recordLink = entry.record;
  if (recordLink && typeof recordLink === "object") {
    const linked = recordLink as Record<string, unknown>;
    const linkedId = asString(linked.id);
    const linkedTitle = asString(linked.title);
    if (linkedId && linkedTitle) {
      return [`${linkedTitle} (${linkedId})`];
    }
    if (linkedId) {
      return [linkedId];
    }
  }

  return [];
}

function extractFieldValues(field: RawRecordField): {
  values: string[];
  valuesByLanguage: Array<{ languageId: string; values: string[] }>;
} {
  const localizedValues = field.localizedValues ?? [];
  const valuesByLanguage: Array<{ languageId: string; values: string[] }> = [];
  const allValues = new Set<string>();

  for (const entry of localizedValues) {
    const languageId = asString(entry.languageId) ?? "unknown";
    const entryValues = extractLocalizedEntryValues(entry);

    if (entryValues.length > 0) {
      valuesByLanguage.push({ languageId, values: entryValues });
      for (const value of entryValues) {
        allValues.add(value);
      }
    }
  }

  return {
    values: [...allValues],
    valuesByLanguage,
  };
}

function buildMissingFieldValue(fieldQuery: string): RecordFieldValue {
  return {
    fieldQuery,
    fieldId: null,
    fieldName: null,
    label: null,
    dataType: null,
    found: false,
    values: [],
    valuesByLanguage: [],
  };
}

function buildFieldValue(
  fieldQuery: string,
  field: RawRecordField,
): RecordFieldValue {
  const extracted = extractFieldValues(field);

  return {
    fieldQuery,
    fieldId: field.id ?? null,
    fieldName: field.fieldName ?? null,
    label: field.label ?? null,
    dataType: asString(field.dataType),
    found: true,
    values: extracted.values,
    valuesByLanguage: extracted.valuesByLanguage,
  };
}

export function extractRequestedFieldValues(
  fields: RawRecordField[],
  fieldQueries: string[],
): RecordFieldValue[] {
  const uniqueQueries = [
    ...new Set(fieldQueries.map((query) => query.trim()).filter(Boolean)),
  ];

  return uniqueQueries.map((fieldQuery) => {
    const matches = fields.filter((field) => fieldMatchesQuery(field, fieldQuery));

    if (matches.length === 0) {
      return buildMissingFieldValue(fieldQuery);
    }

    if (matches.length > 1) {
      const exactMatches = matches.filter((field) => {
        const normalizedQuery = normalizeText(fieldQuery);
        if (isGuid(fieldQuery)) {
          return normalizeGuid(field.id ?? "") === normalizeGuid(fieldQuery);
        }

        return (
          normalizeText(field.fieldName ?? "") === normalizedQuery ||
          normalizeText(field.label ?? "") === normalizedQuery
        );
      });

      const resolved = exactMatches.length === 1 ? exactMatches[0] : matches[0];
      return buildFieldValue(fieldQuery, resolved);
    }

    return buildFieldValue(fieldQuery, matches[0]!);
  });
}

export function buildAllFieldMetadata(fields: RawRecordField[]): RecordFieldValue[] {
  return fields.map((field) =>
    buildFieldValue(field.fieldName ?? field.label ?? field.id ?? "unknown", field),
  );
}

export function extractFieldsFromRecord(data: HalRecordWithFields): RawRecordField[] {
  const embeddedFields = data._embedded?.fields;

  if (Array.isArray(embeddedFields)) {
    return embeddedFields;
  }

  if (embeddedFields && Array.isArray(embeddedFields.items)) {
    return embeddedFields.items;
  }

  return [];
}

async function fetchFieldsSubResource(
  client: AprimoClient,
  recordId: string,
): Promise<RawRecordField[]> {
  const data = await client.get<{ items?: RawRecordField[] }>(
    `/api/core/record/${recordId}/fields`,
    RECORD_FIELDS_HEADERS,
  );

  return data.items ?? [];
}

export async function fetchRecordFields(
  client: AprimoClient,
  recordId: string,
): Promise<RawRecordField[]> {
  const normalizedId = normalizeGuid(recordId);
  const data = await client.get<HalRecordWithFields>(
    `/api/core/record/${normalizedId}`,
    RECORD_WITH_METADATA_HEADERS,
  );

  const embeddedFields = extractFieldsFromRecord(data);
  if (embeddedFields.length > 0) {
    return embeddedFields;
  }

  return fetchFieldsSubResource(client, normalizedId);
}

export async function fetchRecordMetadata(
  client: AprimoClient,
  recordId: string,
  fieldQueries: string[],
): Promise<RecordFieldValue[]> {
  const fields = await fetchRecordFields(client, recordId);
  return extractRequestedFieldValues(fields, fieldQueries);
}

function mapRecordSummary(raw: HalRecordWithFields, id: string): Omit<RecordWithMetadata, "metadata"> {
  return {
    id: raw.id ?? id,
    title: raw.title ?? null,
    status: asString(raw.status),
    contentType: asString(raw.contentType),
    createdOn: asString(raw.createdOn),
    modifiedOn: asString(raw.modifiedOn),
    thumbnailUrl: extractThumbnailUrl(raw),
  };
}

export async function fetchRecordSummary(
  client: AprimoClient,
  recordId: string,
): Promise<Omit<RecordWithMetadata, "metadata">> {
  const trimmedId = recordId.trim();
  if (!isRecordId(trimmedId)) {
    throw new Error(
      "recordId must be a 32-character hex Aprimo record ID or GUID",
    );
  }

  const normalizedId = normalizeGuid(trimmedId);
  const data = await client.get<HalRecordWithFields>(
    `/api/core/record/${normalizedId}`,
    RECORD_SUMMARY_HEADERS,
  );

  return mapRecordSummary(data, normalizedId);
}

export async function fetchRecordById(
  client: AprimoClient,
  recordId: string,
  options: {
    metadataFields?: string[];
    includeAllMetadata?: boolean;
  },
): Promise<RecordWithMetadata> {
  const trimmedId = recordId.trim();
  if (!isRecordId(trimmedId)) {
    throw new Error(
      "recordId must be a 32-character hex Aprimo record ID or GUID",
    );
  }

  const metadataFields = options.metadataFields
    ?.map((field) => field.trim())
    .filter(Boolean);
  const includeAllMetadata = options.includeAllMetadata === true;

  if (!includeAllMetadata && (!metadataFields || metadataFields.length === 0)) {
    throw new Error(
      "Pass includeAllMetadata=true or metadataFields to retrieve field values",
    );
  }

  const normalizedId = normalizeGuid(trimmedId);
  const data = await client.get<HalRecordWithFields>(
    `/api/core/record/${normalizedId}`,
    RECORD_WITH_METADATA_HEADERS,
  );

  let fields = extractFieldsFromRecord(data);
  if (fields.length === 0) {
    fields = await fetchFieldsSubResource(client, normalizedId);
  }

  const metadata = includeAllMetadata
    ? buildAllFieldMetadata(fields)
    : extractRequestedFieldValues(fields, metadataFields!);

  return {
    ...mapRecordSummary(data, normalizedId),
    metadata,
  };
}
