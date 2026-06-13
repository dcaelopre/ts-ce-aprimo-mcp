import type { AprimoClient } from "./client.js";
import type { AprimoConfig } from "../config.js";

export interface SearchRecordsParams {
  query: string;
  page?: number;
  pageSize?: number;
}

export interface SearchRecordResult {
  id: string;
  title: string | null;
  status: string | null;
  thumbnailUrl: string | null;
}

export interface SearchRecordsResponse {
  page: number;
  pageSize: number;
  totalCount: number | null;
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
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) {
    throw new Error("Search query cannot be empty");
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

  return {
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    totalCount: data.totalCount ?? null,
    records: rawRecords.map(mapRecord).filter((record) => record.id),
  };
}
