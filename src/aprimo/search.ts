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
  normalizeGuid,
  type RecordFieldValue,
} from "./record-metadata.js";

export type RecordStatus = "Draft" | "Released" | "Archived";

export interface SearchRecordsParams {
  query?: string;
  recordId?: string;
  searchExpression?: string;
  status?: RecordStatus;
  contentType?: string;
  classificationId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  metadataFields?: string[];
  includeAllMetadata?: boolean;
}

export interface SearchRecordResult {
  id: string;
  title: string | null;
  status: string | null;
  contentType: string | null;
  createdOn: string | null;
  modifiedOn: string | null;
  thumbnailUrl: string | null;
  metadata?: RecordFieldValue[];
}

export interface SearchRecordsResponse {
  lookupMode: "keyword" | "recordId" | "searchExpression";
  page: number;
  pageSize: number;
  totalCount: number | null;
  searchExpression?: string;
  sort?: string;
  filters?: {
    status?: RecordStatus;
    contentType?: string;
    classificationId?: string;
  };
  metadataFields?: string[];
  includeAllMetadata?: boolean;
  metadataHint?: string;
  records: SearchRecordResult[];
}

const METADATA_HINT =
  "Only basic record info was returned (id, title, status, contentType, createdOn, modifiedOn, thumbnail). Ask the user if they want full metadata (includeAllMetadata=true) or specific fields (metadataFields).";

interface HalLink {
  href?: string;
}

interface HalRecord {
  id?: string;
  title?: string;
  status?: string;
  contentType?: string;
  createdOn?: string;
  modifiedOn?: string;
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
    status: asString(record.status),
    contentType: asString(record.contentType),
    createdOn: asString(record.createdOn),
    modifiedOn: asString(record.modifiedOn),
    thumbnailUrl: extractThumbnailUrl(record),
  };
}

function escapeAprimoSearchLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildKeywordClause(query: string, searchFields: string[]): string {
  const term = escapeAprimoSearchLiteral(query.trim());
  const clauses = searchFields.map((field) => `${field} CONTAINS '${term}'`);
  return `(${clauses.join(" OR ")})`;
}

export function buildRecordSearchExpression(
  params: Pick<
    SearchRecordsParams,
    "query" | "searchExpression" | "status" | "contentType" | "classificationId"
  >,
  searchFields: string[],
): string {
  const rawExpression = params.searchExpression?.trim();
  if (rawExpression) {
    return rawExpression;
  }

  const clauses: string[] = [];
  const query = params.query?.trim();

  if (query) {
    clauses.push(buildKeywordClause(query, searchFields));
  }

  if (params.status) {
    clauses.push(`ContentStatus = '${params.status}'`);
  }

  if (params.contentType?.trim()) {
    clauses.push(`ContentType = '${escapeAprimoSearchLiteral(params.contentType.trim())}'`);
  }

  if (params.classificationId?.trim()) {
    clauses.push(
      `Classification = '${escapeAprimoSearchLiteral(normalizeGuid(params.classificationId.trim()))}'`,
    );
  }

  if (clauses.length === 0) {
    throw new Error(
      "Provide a keyword query, searchExpression, or at least one filter (status, contentType, classificationId)",
    );
  }

  return clauses.join(" AND ");
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

function buildSearchQueryString(
  page: number,
  pageSize: number,
  sort?: string,
): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (sort?.trim()) {
    params.set("sort", sort.trim());
  }

  return params.toString();
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
          contentType: record.contentType,
          createdOn: record.createdOn,
          modifiedOn: record.modifiedOn,
          thumbnailUrl: record.thumbnailUrl,
          metadata: record.metadata,
        },
      ],
    };
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const wantsMetadata = Boolean(metadataFields?.length || includeAllMetadata);
  const expression = buildRecordSearchExpression(params, config.searchFields);
  const lookupMode = params.searchExpression?.trim()
    ? "searchExpression"
    : "keyword";

  const filters = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.contentType?.trim()
      ? { contentType: params.contentType.trim() }
      : {}),
    ...(params.classificationId?.trim()
      ? { classificationId: normalizeGuid(params.classificationId.trim()) }
      : {}),
  };

  const data = await client.post<HalSearchResponse>(
    `/api/core/search/records?${buildSearchQueryString(page, pageSize, params.sort)}`,
    {
      searchExpression: {
        expression,
      },
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
    lookupMode,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    totalCount: data.totalCount ?? null,
    searchExpression: expression,
    ...(params.sort?.trim() ? { sort: params.sort.trim() } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    records: recordsWithMetadata,
    ...(metadataFields && metadataFields.length > 0 ? { metadataFields } : {}),
    ...(includeAllMetadata ? { includeAllMetadata: true } : {}),
    ...(!wantsMetadata && recordsWithMetadata.length > 0
      ? { metadataHint: METADATA_HINT }
      : {}),
  };
}
