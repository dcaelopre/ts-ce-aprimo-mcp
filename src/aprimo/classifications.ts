import type { AprimoClient } from "./client.js";
import {
  CLASSIFICATION_WITH_CHILDREN_HEADERS,
  CLASSIFICATION_WITH_RELATIONS_HEADERS,
  SEARCH_CLASSIFICATION_HEADERS,
} from "./headers.js";
import { isGuid, normalizeGuid } from "./record-metadata.js";

export interface SearchClassificationsParams {
  query?: string;
  parentId?: string;
  includeChildren?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ClassificationLabel {
  languageId: string;
  value: string;
}

export interface ClassificationChildSummary {
  id: string;
  identifier: string;
  name: string;
  labelPath: string | null;
  hasChildren: boolean | null;
  sortIndex: number | null;
}

export interface ClassificationSummary {
  id: string;
  identifier: string;
  name: string;
  namePath: string | null;
  labelPath: string | null;
  labels: ClassificationLabel[];
  isRoot: boolean;
  parentId: string | null;
  hasChildren: boolean | null;
  sortIndex: number | null;
  sortOrder: string | null;
  disabledInDAMUI: boolean;
  createdOn: string | null;
  modifiedOn: string | null;
  registeredFieldCount: number;
  registeredFieldGroupCount: number;
  children?: ClassificationChildSummary[];
}

export interface SearchClassificationsResponse {
  matchCount: number;
  matchedBy: "id" | "name" | "identifier" | "label" | "parentId" | "search";
  page?: number;
  pageSize?: number;
  parentId?: string;
  classifications: ClassificationSummary[];
}

type RawClassification = Record<string, unknown> & {
  id?: string;
  identifier?: string;
  name?: string;
  namePath?: string;
  labelPath?: string;
  labels?: Array<{ languageId?: string; value?: string }>;
  isRoot?: boolean;
  parentId?: string;
  hasChildren?: boolean;
  sortIndex?: number;
  sortOrder?: string;
  disabledInDAMUI?: boolean;
  createdOn?: string;
  modifiedOn?: string;
  registeredFields?: unknown[];
  registeredFieldGroups?: unknown[];
  _embedded?: {
    children?:
      | RawClassification[]
      | {
          items?: RawClassification[];
        };
  };
};

interface ClassificationPage {
  items?: RawClassification[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

interface ClassificationSearchResponse {
  items?: RawClassification[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function escapeAprimoSearchLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function mapLabels(
  labels: RawClassification["labels"],
): ClassificationLabel[] {
  return (labels ?? [])
    .filter(
      (entry): entry is { languageId: string; value: string } =>
        typeof entry.languageId === "string" && typeof entry.value === "string",
    )
    .map((entry) => ({
      languageId: entry.languageId,
      value: entry.value,
    }));
}

function mapChildSummary(raw: RawClassification): ClassificationChildSummary {
  return {
    id: raw.id ?? "",
    identifier: raw.identifier ?? "",
    name: raw.name ?? "",
    labelPath: asString(raw.labelPath),
    hasChildren: typeof raw.hasChildren === "boolean" ? raw.hasChildren : null,
    sortIndex: asNumber(raw.sortIndex),
  };
}

function extractEmbeddedChildren(
  raw: RawClassification,
): RawClassification[] {
  const embeddedChildren = raw._embedded?.children;

  if (Array.isArray(embeddedChildren)) {
    return embeddedChildren;
  }

  if (embeddedChildren && Array.isArray(embeddedChildren.items)) {
    return embeddedChildren.items;
  }

  return [];
}

function mapClassification(
  raw: RawClassification,
  includeChildren: boolean,
): ClassificationSummary {
  const summary: ClassificationSummary = {
    id: raw.id ?? "",
    identifier: raw.identifier ?? "",
    name: raw.name ?? "",
    namePath: asString(raw.namePath),
    labelPath: asString(raw.labelPath),
    labels: mapLabels(raw.labels),
    isRoot: raw.isRoot === true,
    parentId: asString(raw.parentId),
    hasChildren: typeof raw.hasChildren === "boolean" ? raw.hasChildren : null,
    sortIndex: asNumber(raw.sortIndex),
    sortOrder: asString(raw.sortOrder),
    disabledInDAMUI: asBoolean(raw.disabledInDAMUI),
    createdOn: asString(raw.createdOn),
    modifiedOn: asString(raw.modifiedOn),
    registeredFieldCount: Array.isArray(raw.registeredFields)
      ? raw.registeredFields.length
      : 0,
    registeredFieldGroupCount: Array.isArray(raw.registeredFieldGroups)
      ? raw.registeredFieldGroups.length
      : 0,
  };

  if (includeChildren) {
    const children = extractEmbeddedChildren(raw)
      .map(mapChildSummary)
      .filter((child) => child.id);

    if (children.length > 0) {
      summary.children = children;
    }
  }

  return summary;
}

function paginateClassifications<T>(
  items: T[],
  page?: number,
  pageSize?: number,
): { items: T[]; page: number; pageSize: number } {
  const resolvedPage = page ?? 1;
  const resolvedPageSize = pageSize ?? 25;
  const start = (resolvedPage - 1) * resolvedPageSize;

  return {
    items: items.slice(start, start + resolvedPageSize),
    page: resolvedPage,
    pageSize: resolvedPageSize,
  };
}

function buildListResponse(
  classifications: RawClassification[],
  matchedBy: SearchClassificationsResponse["matchedBy"],
  options?: {
    parentId?: string;
    includeChildren?: boolean;
    page?: number;
    pageSize?: number;
  },
): SearchClassificationsResponse {
  const paginated = paginateClassifications(
    classifications,
    options?.page,
    options?.pageSize,
  );

  return {
    matchCount: classifications.length,
    matchedBy,
    ...(options?.parentId ? { parentId: options.parentId } : {}),
    page: paginated.page,
    pageSize: paginated.pageSize,
    classifications: paginated.items.map((item) =>
      mapClassification(item, options?.includeChildren === true),
    ),
  };
}

async function getClassificationById(
  client: AprimoClient,
  id: string,
  includeChildren: boolean,
): Promise<ClassificationSummary> {
  const normalizedId = normalizeGuid(id);
  const headers = includeChildren
    ? CLASSIFICATION_WITH_RELATIONS_HEADERS
    : { languages: "*" };

  const raw = await client.get<RawClassification>(
    `/api/core/classification/${normalizedId}`,
    headers,
  );

  return mapClassification(raw, includeChildren);
}

async function fetchChildrenSubResource(
  client: AprimoClient,
  parentId: string,
): Promise<RawClassification[]> {
  const normalizedId = normalizeGuid(parentId);
  const raw = await client.get<RawClassification>(
    `/api/core/classification/${normalizedId}`,
    CLASSIFICATION_WITH_CHILDREN_HEADERS,
  );

  const embeddedChildren = extractEmbeddedChildren(raw);
  if (embeddedChildren.length > 0) {
    return embeddedChildren;
  }

  const childrenPage = await client.get<ClassificationPage>(
    `/api/core/classification/${normalizedId}/children?page=1&pageSize=200`,
    { languages: "*" },
  );

  return childrenPage.items ?? [];
}

async function searchClassificationsByExpression(
  client: AprimoClient,
  query: string,
  page: number,
  pageSize: number,
  includeChildren: boolean,
): Promise<RawClassification[]> {
  const term = escapeAprimoSearchLiteral(query.trim());
  const queryString = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  }).toString();

  const data = await client.post<ClassificationSearchResponse>(
    `/api/core/search/classifications?${queryString}`,
    {
      searchExpression: {
        expression: `Name CONTAINS '${term}' OR Identifier CONTAINS '${term}'`,
      },
    },
    includeChildren ? SEARCH_CLASSIFICATION_HEADERS : { languages: "*" },
  );

  return data.items ?? [];
}

async function listAllClassifications(
  client: AprimoClient,
): Promise<RawClassification[]> {
  const all: RawClassification[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await client.get<ClassificationPage>(
      `/api/core/classifications?page=${page}&pageSize=${pageSize}`,
      { languages: "*" },
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

function matchesLabel(classification: RawClassification, query: string): boolean {
  const normalizedQuery = normalizeText(query);

  if (classification.labelPath?.toLocaleLowerCase().includes(normalizedQuery)) {
    return true;
  }

  return (classification.labels ?? []).some((entry) =>
    entry.value?.toLocaleLowerCase().includes(normalizedQuery),
  );
}

function findByName(
  classifications: RawClassification[],
  query: string,
): RawClassification[] {
  const normalizedQuery = normalizeText(query);
  return classifications.filter(
    (item) => item.name?.toLocaleLowerCase() === normalizedQuery,
  );
}

function findByIdentifier(
  classifications: RawClassification[],
  query: string,
): RawClassification[] {
  const normalizedQuery = normalizeText(query);
  return classifications.filter(
    (item) => item.identifier?.toLocaleLowerCase() === normalizedQuery,
  );
}

function findByLabel(
  classifications: RawClassification[],
  query: string,
): RawClassification[] {
  return classifications.filter((item) => matchesLabel(item, query));
}

export async function searchClassifications(
  client: AprimoClient,
  params: SearchClassificationsParams,
): Promise<SearchClassificationsResponse> {
  const query = params.query?.trim();
  const parentId = params.parentId?.trim();
  const includeChildren = params.includeChildren === true;

  if (!query && !parentId) {
    throw new Error("Provide a query (GUID, name, identifier, or label) and/or a parentId");
  }

  if (parentId && !query) {
    const children = await fetchChildrenSubResource(client, parentId);

    return buildListResponse(children, "parentId", {
      parentId: normalizeGuid(parentId),
      includeChildren: false,
      page: params.page,
      pageSize: params.pageSize,
    });
  }

  if (query && isGuid(query)) {
    const classification = await getClassificationById(
      client,
      query,
      includeChildren,
    );

    return {
      matchCount: 1,
      matchedBy: "id",
      classifications: [classification],
    };
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  let matchedBy: SearchClassificationsResponse["matchedBy"] = "search";
  let matches = await searchClassificationsByExpression(
    client,
    query!,
    page,
    pageSize,
    includeChildren,
  );

  if (matches.length === 0) {
    const allClassifications = await listAllClassifications(client);
    const nameMatches = findByName(allClassifications, query!);

    if (nameMatches.length > 0) {
      matches = nameMatches;
      matchedBy = "name";
    } else {
      const identifierMatches = findByIdentifier(allClassifications, query!);
      if (identifierMatches.length > 0) {
        matches = identifierMatches;
        matchedBy = "identifier";
      } else {
        matches = findByLabel(allClassifications, query!);
        matchedBy = "label";
      }
    }
  }

  if (parentId) {
    const normalizedParentId = normalizeGuid(parentId);
    matches = matches.filter(
      (item) => normalizeGuid(item.parentId ?? "") === normalizedParentId,
    );
  }

  if (matches.length === 0) {
    throw new Error(
      `No classification found matching "${query}" by id, name, identifier, or label`,
    );
  }

  if (matchedBy === "search") {
    return {
      matchCount: matches.length,
      matchedBy,
      page,
      pageSize,
      ...(parentId ? { parentId: normalizeGuid(parentId) } : {}),
      classifications: matches.map((item) =>
        mapClassification(item, includeChildren),
      ),
    };
  }

  return buildListResponse(matches, matchedBy, {
    parentId: parentId ? normalizeGuid(parentId) : undefined,
    includeChildren,
    page: params.page,
    pageSize: params.pageSize,
  });
}
