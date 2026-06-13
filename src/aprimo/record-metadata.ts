import type { AprimoClient } from "./client.js";

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

interface HalRecordWithFields {
  id?: string;
  title?: string | null;
  _embedded?: {
    fields?: {
      items?: RawRecordField[];
    };
  };
}

const GUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function normalizeGuid(value: string): string {
  return value.replace(/-/g, "").toLowerCase();
}

function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value.trim());
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

export async function fetchRecordFields(
  client: AprimoClient,
  recordId: string,
): Promise<RawRecordField[]> {
  const normalizedId = normalizeGuid(recordId);
  const data = await client.get<HalRecordWithFields>(`/api/core/record/${normalizedId}`, {
    "select-record": "fields,title",
    languages: "*",
  });

  return data._embedded?.fields?.items ?? [];
}

export async function fetchRecordMetadata(
  client: AprimoClient,
  recordId: string,
  fieldQueries: string[],
): Promise<RecordFieldValue[]> {
  const fields = await fetchRecordFields(client, recordId);
  return extractRequestedFieldValues(fields, fieldQueries);
}
