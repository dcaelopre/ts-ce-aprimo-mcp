import type { AprimoClient } from "./client.js";
import { fetchClassificationById } from "./classifications.js";
import {
  RULE_SUMMARY_HEADERS,
  RULE_WITH_DETAILS_HEADERS,
} from "./headers.js";
import { isGuid, normalizeGuid } from "./record-metadata.js";

export type RuleTarget =
  | "SettingDefinition"
  | "FieldDefinition"
  | "IndexerTask"
  | "Translation"
  | "SettingCategory"
  | "UserGroup"
  | "Watermark"
  | "FieldGroup"
  | "Collection"
  | "User"
  | "Classification"
  | "Record"
  | "Language"
  | "FileType"
  | "Organization"
  | "Site"
  | "Publication"
  | "Subscription"
  | "Filestore"
  | "SavedView";

export type RuleTrigger = "WhenSavedOrDeleted" | "Daily";

export interface SearchRulesParams {
  query?: string;
  target?: RuleTarget;
  enabled?: boolean;
  trigger?: RuleTrigger;
  includeDetails?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ResolvedClassification {
  id: string;
  name: string;
  identifier: string;
  label: string | null;
  path: string;
  namePath: string | null;
  labelPath: string | null;
}

export interface RuleConditionSummary {
  conditionType: string;
  index: number | null;
  classification?: ResolvedClassification;
  classifications?: ResolvedClassification[];
  details: Record<string, unknown>;
}

export interface RuleActionSummary {
  actionType: string;
  index: number | null;
  classification?: ResolvedClassification;
  classifications?: ResolvedClassification[];
  details: Record<string, unknown>;
}

export interface RuleSummary {
  id: string;
  name: string;
  enabled: boolean;
  target: string | null;
  trigger: string | null;
  expression: string | null;
  includeDraftRecords: boolean | null;
  isInternal: boolean | null;
  version: number | null;
  createdOn: string | null;
  modifiedOn: string | null;
  conditionCount: number;
  actionCount: number;
  conditions?: RuleConditionSummary[];
  actions?: RuleActionSummary[];
}

export interface SearchRulesResponse {
  matchCount: number;
  matchedBy: "id" | "name" | "list";
  page: number;
  pageSize: number;
  totalCount: number | null;
  filters?: {
    target?: RuleTarget;
    enabled?: boolean;
    trigger?: RuleTrigger;
  };
  rules: RuleSummary[];
}

type RawRule = Record<string, unknown> & {
  id?: string;
  name?: string;
  enabled?: boolean;
  target?: string;
  trigger?: string;
  expression?: string;
  includeDraftRecords?: boolean;
  isInternal?: boolean;
  version?: number;
  createdOn?: string;
  modifiedOn?: string;
  _embedded?: {
    conditions?:
      | Array<Record<string, unknown>>
      | { items?: Array<Record<string, unknown>> };
    actions?:
      | Array<Record<string, unknown>>
      | { items?: Array<Record<string, unknown>> };
  };
};

interface RulePage {
  items?: RawRule[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

const RULE_TARGET_VALUES = new Set<string>([
  "SettingDefinition",
  "FieldDefinition",
  "IndexerTask",
  "Translation",
  "SettingCategory",
  "UserGroup",
  "Watermark",
  "FieldGroup",
  "Collection",
  "User",
  "Classification",
  "Record",
  "Language",
  "FileType",
  "Organization",
  "Site",
  "Publication",
  "Subscription",
  "Filestore",
  "SavedView",
]);

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function extractEmbeddedItems(
  embedded:
    | Array<Record<string, unknown>>
    | { items?: Array<Record<string, unknown>> }
    | undefined,
): Array<Record<string, unknown>> {
  if (!embedded) {
    return [];
  }

  if (Array.isArray(embedded)) {
    return embedded;
  }

  return embedded.items ?? [];
}

function summarizeConditionItem(
  item: Record<string, unknown>,
): RuleConditionSummary {
  const conditionType = asString(item.conditionType) ?? "Unknown";
  const { conditionType: _type, index, ...rest } = item;

  return {
    conditionType,
    index: asNumber(index),
    details: rest,
  };
}

function summarizeActionItem(item: Record<string, unknown>): RuleActionSummary {
  const actionType = asString(item.actionType) ?? "Unknown";
  const { actionType: _type, index, ...rest } = item;

  return {
    actionType,
    index: asNumber(index),
    details: rest,
  };
}

function formatClassificationPath(
  namePath: string | null,
  labelPath: string | null,
  name: string,
): string {
  const raw = labelPath?.trim() || namePath?.trim();
  if (!raw) {
    return name;
  }

  const segments = raw
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments.join(" > ") : name;
}

function primaryClassificationLabel(
  name: string,
  labels: Array<{ languageId: string; value: string }>,
): string | null {
  const firstLabel = labels.find((entry) => entry.value.trim().length > 0);
  return firstLabel?.value ?? (name.trim().length > 0 ? name : null);
}

function collectClassificationIds(details: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const singleId = asString(details.classificationId);

  if (singleId) {
    ids.push(singleId);
  }

  const multipleIds = details.classificationIds;
  if (Array.isArray(multipleIds)) {
    for (const id of multipleIds) {
      if (typeof id === "string" && id.trim()) {
        ids.push(id.trim());
      }
    }
  }

  return [...new Set(ids.map((id) => normalizeGuid(id)))];
}

async function resolveClassification(
  client: AprimoClient,
  id: string,
  cache: Map<string, ResolvedClassification | null>,
): Promise<ResolvedClassification | null> {
  const normalizedId = normalizeGuid(id);
  if (cache.has(normalizedId)) {
    return cache.get(normalizedId) ?? null;
  }

  try {
    const classification = await fetchClassificationById(client, normalizedId);
    const resolved: ResolvedClassification = {
      id: classification.id,
      name: classification.name,
      identifier: classification.identifier,
      label: primaryClassificationLabel(classification.name, classification.labels),
      path: formatClassificationPath(
        classification.namePath,
        classification.labelPath,
        classification.name,
      ),
      namePath: classification.namePath,
      labelPath: classification.labelPath,
    };

    cache.set(normalizedId, resolved);
    return resolved;
  } catch {
    cache.set(normalizedId, null);
    return null;
  }
}

async function attachClassificationContext<
  T extends RuleConditionSummary | RuleActionSummary,
>(client: AprimoClient, item: T, cache: Map<string, ResolvedClassification | null>): Promise<T> {
  const ids = collectClassificationIds(item.details);
  if (ids.length === 0) {
    return item;
  }

  const resolved = (
    await Promise.all(ids.map((id) => resolveClassification(client, id, cache)))
  ).filter((entry): entry is ResolvedClassification => entry !== null);

  if (resolved.length === 1) {
    item.classification = resolved[0];
  } else if (resolved.length > 1) {
    item.classifications = resolved;
  }

  return item;
}

async function enrichRuleDetails(
  client: AprimoClient,
  rule: RuleSummary,
): Promise<RuleSummary> {
  const cache = new Map<string, ResolvedClassification | null>();

  if (rule.conditions?.length) {
    rule.conditions = await Promise.all(
      rule.conditions.map((condition) =>
        attachClassificationContext(client, condition, cache),
      ),
    );
  }

  if (rule.actions?.length) {
    rule.actions = await Promise.all(
      rule.actions.map((action) =>
        attachClassificationContext(client, action, cache),
      ),
    );
  }

  return rule;
}

function mapRule(raw: RawRule, includeDetails: boolean): RuleSummary {
  const conditions = extractEmbeddedItems(raw._embedded?.conditions);
  const actions = extractEmbeddedItems(raw._embedded?.actions);

  const summary: RuleSummary = {
    id: raw.id ?? "",
    name: raw.name ?? "",
    enabled: raw.enabled === true,
    target: asString(raw.target),
    trigger: asString(raw.trigger),
    expression: asString(raw.expression),
    includeDraftRecords: asBoolean(raw.includeDraftRecords),
    isInternal: asBoolean(raw.isInternal),
    version: asNumber(raw.version),
    createdOn: asString(raw.createdOn),
    modifiedOn: asString(raw.modifiedOn),
    conditionCount: conditions.length,
    actionCount: actions.length,
  };

  if (includeDetails) {
    summary.conditions = conditions.map(summarizeConditionItem);
    summary.actions = actions.map(summarizeActionItem);
  }

  return summary;
}

async function getRuleById(
  client: AprimoClient,
  id: string,
  includeDetails: boolean,
): Promise<RuleSummary> {
  const normalizedId = normalizeGuid(id);
  const headers = includeDetails ? RULE_WITH_DETAILS_HEADERS : RULE_SUMMARY_HEADERS;

  const raw = await client.get<RawRule>(
    `/api/core/rule/${normalizedId}`,
    headers,
  );

  const rule = mapRule(raw, includeDetails);
  if (includeDetails) {
    await enrichRuleDetails(client, rule);
  }

  return rule;
}

async function listAllRules(client: AprimoClient): Promise<RawRule[]> {
  const all: RawRule[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await client.get<RulePage>(
      `/api/core/rules?page=${page}&pageSize=${pageSize}`,
      RULE_SUMMARY_HEADERS,
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

function matchesName(rule: RawRule, query: string): boolean {
  return rule.name?.toLocaleLowerCase() === normalizeText(query);
}

function matchesPartialName(rule: RawRule, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return Boolean(rule.name?.toLocaleLowerCase().includes(normalizedQuery));
}

function applyFilters(
  rules: RawRule[],
  params: Pick<SearchRulesParams, "target" | "enabled" | "trigger">,
): RawRule[] {
  return rules.filter((rule) => {
    if (params.target && rule.target !== params.target) {
      return false;
    }

    if (params.enabled !== undefined && rule.enabled !== params.enabled) {
      return false;
    }

    if (params.trigger && rule.trigger !== params.trigger) {
      return false;
    }

    return true;
  });
}

function paginateRules<T>(
  rules: T[],
  page?: number,
  pageSize?: number,
): { items: T[]; page: number; pageSize: number } {
  const resolvedPage = page ?? 1;
  const resolvedPageSize = pageSize ?? 25;
  const start = (resolvedPage - 1) * resolvedPageSize;

  return {
    items: rules.slice(start, start + resolvedPageSize),
    page: resolvedPage,
    pageSize: resolvedPageSize,
  };
}

function buildFilters(
  params: Pick<SearchRulesParams, "target" | "enabled" | "trigger">,
): SearchRulesResponse["filters"] {
  const filters: NonNullable<SearchRulesResponse["filters"]> = {};

  if (params.target) {
    filters.target = params.target;
  }

  if (params.enabled !== undefined) {
    filters.enabled = params.enabled;
  }

  if (params.trigger) {
    filters.trigger = params.trigger;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function isRuleTarget(value: string): value is RuleTarget {
  return RULE_TARGET_VALUES.has(value);
}

export async function searchRules(
  client: AprimoClient,
  params: SearchRulesParams,
): Promise<SearchRulesResponse> {
  const query = params.query?.trim();
  const includeDetails = params.includeDetails === true;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  if (params.target && !isRuleTarget(params.target)) {
    throw new Error(
      `Invalid target "${params.target}". Use a DAM rule target such as Record or Classification.`,
    );
  }

  if (query && isGuid(query)) {
    const rule = await getRuleById(client, query, includeDetails);

    return {
      matchCount: 1,
      matchedBy: "id",
      page: 1,
      pageSize: 1,
      totalCount: 1,
      ...(buildFilters(params) ? { filters: buildFilters(params) } : {}),
      rules: [rule],
    };
  }

  const allRules = await listAllRules(client);
  let matched = applyFilters(allRules, params);
  let matchedBy: SearchRulesResponse["matchedBy"] = "list";

  if (query) {
    const exactMatches = matched.filter((rule) => matchesName(rule, query));
    if (exactMatches.length > 0) {
      matched = exactMatches;
      matchedBy = "name";
    } else {
      matched = matched.filter((rule) => matchesPartialName(rule, query));
      matchedBy = "name";
    }

    if (matched.length === 0) {
      throw new Error(`No DAM rule found matching "${query}" by id or name`);
    }
  }

  const paginated = paginateRules(matched, page, pageSize);

  const rules = await Promise.all(
    paginated.items.map(async (raw) => {
      if (!includeDetails) {
        return mapRule(raw, false);
      }

      if (!raw.id) {
        return mapRule(raw, false);
      }

      return getRuleById(client, raw.id, true);
    }),
  );

  return {
    matchCount: matched.length,
    matchedBy,
    page: paginated.page,
    pageSize: paginated.pageSize,
    totalCount: matched.length,
    ...(buildFilters(params) ? { filters: buildFilters(params) } : {}),
    rules,
  };
}
