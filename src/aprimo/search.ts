import type { AprimoClient } from "./client.js";
import type { AprimoConfig } from "../config.js";
import {
  SEARCH_RECORD_BASIC_HEADERS,
  SEARCH_RECORD_WITH_FIELDS_HEADERS,
} from "./headers.js";
import {
  buildAllFieldMetadata,
  extractFieldsFromRecord,
  extractRequestedFieldValues,
  fetchRecordById,
  fetchRecordMetadata,
  fetchRecordSummary,
  isRecordId,
  type RecordFieldValue,
} from "./record-metadata.js";

export interface SearchRecordsParams {
  query?: string;
  recordId?: string;
  page?: number;
  pageSize?: number;
  metadataFields?: string[];
  includeAllMetadata?: boolean;
}

export interface SearchRecordResult {
  id: string;
  title: string | null;
  status: string | null;
  thumbnailUrl: string | null;
  metadata?: RecordFieldValue[];
}

export interface SearchRecordsResponse {
  lookupMode: "keyword" | "recordId";
  page: number;
  pageSize: number;
  totalCount: number | null;
  metadataFields?: string[];
  includeAllMetadata?: boolean;
  metadataHint?: string;
  records: SearchRecordResult[];
}

const METADATA_HINT =
  "Only basic record info was returned (id, title, status, thumbnail). Ask the user if they want full metadata (includeAllMetadata=true) or specific fields (metadataFields).";

interface HalLink {
  href?: string;
}

interface HalRecord {
  id?: string;
  title?: string;
  status?: string;
  thumbnail?: { uri?: string; href?: string };
  _links?: {
    thumbnail?: HalLink;
    self?: HalLink;
  };
  _embedded?: {
    fields?:
      | Array<Record<string, unknown>>
      | {
          items?: Array<Record<string, unknown>>;
        };
  };
}

interface HalSearchResponse {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  items?: HalRecord[];
  _embedded?: {
    records?: HalRecord[];
    items?: HalRecord[];
  };
}

function extractThumbnailUrl(record: HalRecord): string | null {
  return (
    record.thumbnail?.uri ??
    record.thumbnail?.href ??
    record._links?.thumbnail?.href ??
    null
  );
}

function mapRecord(record: HalRecord): SearchRecordResult {
  return {
    id: record.id ?? "",
    title: record.title ?? null,
    status: record.status ?? null,
    thumbnailUrl: extractThumbnailUrl(record),
  };
}

function escapeAprimoSearchLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildKeywordSearchExpression(
  query: string,
  searchFields: string[],
): { expression: string } {
  const term = escapeAprimoSearchLiteral(query.trim());
  const clauses = searchFields.map((field) => `${field} CONTAINS '${term}'`);

  return {
    expression: clauses.join(" OR "),
  };
}

function resolveRecordLookup(params: SearchRecordsParams): string | null {
  const explicitRecordId = params.recordId?.trim();
  if (explicitRecordId) {
    return explicitRecordId;
  }

  const query = params.query?.trim();
  if (query && isRecordId(query)) {
    return query;
  }

  return null;
}

async function attachMetadataToRecords(
  client: AprimoClient,
  records: SearchRecordResult[],
  rawRecords: HalRecord[],
  metadataFields: string[] | undefined,
  includeAllMetadata: boolean,
): Promise<SearchRecordResult[]> {
  const wantsMetadata = Boolean(metadataFields?.length || includeAllMetadata);
  if (!wantsMetadata) {
    return records;
  }

  const shouldFetchAllMetadata = includeAllMetadata && !metadataFields?.length;

  return Promise.all(
    records.map(async (record, index) => {
      const rawRecord = rawRecords[index];
      const embeddedFields = rawRecord
        ? extractFieldsFromRecord(rawRecord as Parameters<typeof extractFieldsFromRecord>[0])
        : [];

      if (embeddedFields.length > 0) {
        const metadata = shouldFetchAllMetadata
          ? buildAllFieldMetadata(embeddedFields)
          : extractRequestedFieldValues(embeddedFields, metadataFields!);

        return { ...record, metadata };
      }

      try {
        if (shouldFetchAllMetadata) {
          const fullRecord = await fetchRecordById(client, record.id, {
            includeAllMetadata: true,
          });
          return {
            ...record,
            metadata: fullRecord.metadata,
          };
        }

        const metadata = await fetchRecordMetadata(
          client,
          record.id,
          metadataFields!,
        );

        return { ...record, metadata };
      } catch {
        if (shouldFetchAllMetadata) {
          return { ...record, metadata: [] };
        }

        return {
          ...record,
          metadata: metadataFields!.map((fieldQuery) => ({
            fieldQuery,
            fieldId: null,
            fieldName: null,
            label: null,
            dataType: null,
            found: false,
            values: [],
            valuesByLanguage: [],
          })),
        };
      }
    }),
  );
}

export async function searchRecords(
  client: AprimoClient,
  config: AprimoConfig,
  params: SearchRecordsParams,
): Promise<SearchRecordsResponse> {
  const metadataFields = params.metadataFields
    ?.map((field) => field.trim())
    .filter(Boolean);
  const includeAllMetadata = params.includeAllMetadata === true;
  const resolvedRecordId = resolveRecordLookup(params);

  if (resolvedRecordId) {
    const wantsMetadata = Boolean(metadataFields?.length || includeAllMetadata);

    if (!wantsMetadata) {
      const summary = await fetchRecordSummary(client, resolvedRecordId);

      return {
        lookupMode: "recordId",
        page: 1,
        pageSize: 1,
        totalCount: 1,
        metadataHint: METADATA_HINT,
        records: [summary],
      };
    }

    const record = await fetchRecordById(client, resolvedRecordId, {
      metadataFields,
      includeAllMetadata,
    });

    return {
      lookupMode: "recordId",
      page: 1,
      pageSize: 1,
      totalCount: 1,
      ...(metadataFields && metadataFields.length > 0 ? { metadataFields } : {}),
      ...(includeAllMetadata ? { includeAllMetadata: true } : {}),
      records: [
        {
          id: record.id,
          title: record.title,
          status: record.status,
          thumbnailUrl: record.thumbnailUrl,
          metadata: record.metadata,
        },
      ],
    };
  }

  const trimmedQuery = params.query?.trim();
  if (!trimmedQuery) {
    throw new Error("Provide a keyword query or a recordId");
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const wantsMetadata = Boolean(metadataFields?.length || includeAllMetadata);
  const queryString = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  }).toString();

  const data = await client.post<HalSearchResponse>(
    `/api/core/search/records?${queryString}`,
    {
      searchExpression: buildKeywordSearchExpression(
        trimmedQuery,
        config.searchFields,
      ),
    },
    wantsMetadata ? SEARCH_RECORD_WITH_FIELDS_HEADERS : SEARCH_RECORD_BASIC_HEADERS,
  );

  const rawRecords =
    data.items ??
    data._embedded?.records ??
    data._embedded?.items ??
    [];

  const records = rawRecords.map(mapRecord).filter((record) => record.id);
  const recordsWithMetadata = await attachMetadataToRecords(
    client,
    records,
    rawRecords,
    metadataFields,
    includeAllMetadata,
  );

  return {
    lookupMode: "keyword",
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    totalCount: data.totalCount ?? null,
    records: recordsWithMetadata,
    ...(metadataFields && metadataFields.length > 0 ? { metadataFields } : {}),
    ...(includeAllMetadata ? { includeAllMetadata: true } : {}),
    ...(!wantsMetadata && recordsWithMetadata.length > 0
      ? { metadataHint: METADATA_HINT }
      : {}),
  };
}
