import type { AprimoClient } from "./client.js";
import type { AprimoConfig } from "../config.js";
import {
  fetchRecordById,
  fetchRecordMetadata,
  type RecordFieldValue,
} from "./record-metadata.js";

export interface SearchRecordsParams {
  query?: string;
  recordId?: string;
  page?: number;
  pageSize?: number;
  metadataFields?: string[];
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
  records: SearchRecordResult[];
}

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

export async function searchRecords(
  client: AprimoClient,
  config: AprimoConfig,
  params: SearchRecordsParams,
): Promise<SearchRecordsResponse> {
  const metadataFields = params.metadataFields
    ?.map((field) => field.trim())
    .filter(Boolean);

  if (params.recordId?.trim()) {
    const record = await fetchRecordById(client, params.recordId, metadataFields);

    return {
      lookupMode: "recordId",
      page: 1,
      pageSize: 1,
      totalCount: 1,
      ...(metadataFields && metadataFields.length > 0
        ? { metadataFields }
        : {}),
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
    { "select-record": "title,thumbnail,status" },
  );

  const rawRecords =
    data.items ??
    data._embedded?.records ??
    data._embedded?.items ??
    [];

  const records = rawRecords.map(mapRecord).filter((record) => record.id);

  if (!metadataFields || metadataFields.length === 0) {
    return {
      lookupMode: "keyword",
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
      totalCount: data.totalCount ?? null,
      records,
    };
  }

  const recordsWithMetadata = await Promise.all(
    records.map(async (record) => {
      try {
        const metadata = await fetchRecordMetadata(
          client,
          record.id,
          metadataFields,
        );

        return { ...record, metadata };
      } catch {
        return {
          ...record,
          metadata: metadataFields.map((fieldQuery) => ({
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

  return {
    lookupMode: "keyword",
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    totalCount: data.totalCount ?? null,
    records: recordsWithMetadata,
    metadataFields,
  };
}
