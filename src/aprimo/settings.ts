import type { AprimoClient } from "./client.js";
import { SETTING_DEFINITION_HEADERS } from "./headers.js";
import { isGuid, normalizeGuid } from "./record-metadata.js";

export type SettingScope = "system" | "user" | "usergroup" | "site";

export interface SearchSettingsParams {
  query?: string;
  names?: string[];
  scope?: SettingScope;
  scopeId?: string;
  categoryId?: string;
  includeDefinition?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SettingDefinitionSummary {
  id: string;
  name: string;
  label: string | null;
  dataType: string;
  categoryId: string;
  allowSystemSetting: boolean;
  allowUserSetting: boolean;
  allowSiteSetting: boolean | null;
  allowAnonymousAccess: boolean | null;
  roleRequiredForChange: string | null;
  userGroupSettingMode: string | null;
  helpUrl: string | null;
  labels: Array<{ languageId: string; value: string }>;
  defaultValue: unknown;
  createdOn: string | null;
  modifiedOn: string | null;
  typeConfiguration: Record<string, unknown>;
}

export interface SettingValueSummary {
  name: string;
  value: string | null;
  scope: SettingScope | null;
  scopeId: string | null;
  definition?: SettingDefinitionSummary;
}

export interface SearchSettingsResponse {
  matchCount: number;
  matchedBy: "id" | "name" | "names" | "list";
  scope?: SettingScope;
  scopeId?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  totalCount?: number | null;
  settings?: SettingValueSummary[];
  definitions?: SettingDefinitionSummary[];
}

type RawSettingDefinition = Record<string, unknown> & {
  id?: string;
  name?: string;
  dataType?: string;
  categoryId?: string;
  allowSystemSetting?: boolean;
  allowUserSetting?: boolean;
  allowSiteSetting?: boolean;
  allowAnonymousAccess?: boolean;
  roleRequiredForChange?: string;
  userGroupSettingMode?: string;
  helpUrl?: string;
  labels?: Array<{ languageId?: string; value?: string }>;
  defaultValue?: unknown;
  createdOn?: string;
  modifiedOn?: string;
};

type RawSetting = {
  name?: string;
  value?: string;
};

interface SettingDefinitionPage {
  items?: RawSettingDefinition[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

interface SettingCollection {
  items?: RawSetting[];
}

const BASE_DEFINITION_KEYS = new Set([
  "id",
  "name",
  "dataType",
  "categoryId",
  "allowSystemSetting",
  "allowUserSetting",
  "allowSiteSetting",
  "allowAnonymousAccess",
  "roleRequiredForChange",
  "userGroupSettingMode",
  "helpUrl",
  "labels",
  "defaultValue",
  "createdOn",
  "modifiedOn",
  "tag",
  "webEditor",
  "_links",
  "_embedded",
]);

const SETTING_SCOPE_VALUES = new Set<string>([
  "system",
  "user",
  "usergroup",
  "site",
]);

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function primaryLabel(
  name: string,
  labels: Array<{ languageId: string; value: string }>,
): string | null {
  const firstLabel = labels.find((entry) => entry.value.trim().length > 0);
  return firstLabel?.value ?? (name.trim().length > 0 ? name : null);
}

function mapSettingDefinition(raw: RawSettingDefinition): SettingDefinitionSummary {
  const typeConfiguration: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!BASE_DEFINITION_KEYS.has(key) && !key.startsWith("_")) {
      typeConfiguration[key] = value;
    }
  }

  const labels = (raw.labels ?? [])
    .filter(
      (entry): entry is { languageId: string; value: string } =>
        typeof entry.languageId === "string" && typeof entry.value === "string",
    )
    .map((entry) => ({
      languageId: entry.languageId,
      value: entry.value,
    }));

  const name = raw.name ?? "";

  return {
    id: raw.id ?? "",
    name,
    label: primaryLabel(name, labels),
    dataType: asString(raw.dataType) ?? "Unknown",
    categoryId: asString(raw.categoryId) ?? "",
    allowSystemSetting: raw.allowSystemSetting === true,
    allowUserSetting: raw.allowUserSetting === true,
    allowSiteSetting: asBoolean(raw.allowSiteSetting),
    allowAnonymousAccess: asBoolean(raw.allowAnonymousAccess),
    roleRequiredForChange: asString(raw.roleRequiredForChange),
    userGroupSettingMode: asString(raw.userGroupSettingMode),
    helpUrl: asString(raw.helpUrl),
    labels,
    defaultValue: raw.defaultValue ?? null,
    createdOn: asString(raw.createdOn),
    modifiedOn: asString(raw.modifiedOn),
    typeConfiguration,
  };
}

function buildScopeQuery(
  scope?: SettingScope,
  scopeId?: string,
): string {
  const params: string[] = [];

  if (scope) {
    params.push(`scope=${encodeURIComponent(scope)}`);
  }

  if (scopeId?.trim()) {
    params.push(`scopeId=${encodeURIComponent(normalizeGuid(scopeId.trim()))}`);
  }

  return params.length > 0 ? `?${params.join("&")}` : "";
}

function validateScopeParams(scope?: SettingScope, scopeId?: string): void {
  if ((scope === "usergroup" || scope === "site") && !scopeId?.trim()) {
    throw new Error(`scopeId is required when scope is "${scope}"`);
  }
}

export function isSettingScope(value: string): value is SettingScope {
  return SETTING_SCOPE_VALUES.has(value);
}

async function getSettingDefinitionById(
  client: AprimoClient,
  id: string,
): Promise<SettingDefinitionSummary> {
  const normalizedId = normalizeGuid(id);
  const raw = await client.get<RawSettingDefinition>(
    `/api/core/settingdefinition/${normalizedId}`,
    SETTING_DEFINITION_HEADERS,
  );

  return mapSettingDefinition(raw);
}

async function listAllSettingDefinitions(
  client: AprimoClient,
): Promise<RawSettingDefinition[]> {
  const all: RawSettingDefinition[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await client.get<SettingDefinitionPage>(
      `/api/core/settingdefinitions?page=${page}&pageSize=${pageSize}`,
      SETTING_DEFINITION_HEADERS,
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

function findDefinitionByName(
  definitions: RawSettingDefinition[],
  query: string,
): RawSettingDefinition[] {
  const normalizedQuery = normalizeText(query);
  return definitions.filter(
    (definition) => definition.name?.toLocaleLowerCase() === normalizedQuery,
  );
}

function findDefinitionsByPartialName(
  definitions: RawSettingDefinition[],
  query: string,
): RawSettingDefinition[] {
  const normalizedQuery = normalizeText(query);
  return definitions.filter((definition) =>
    definition.name?.toLocaleLowerCase().includes(normalizedQuery),
  );
}

function filterByCategory(
  definitions: RawSettingDefinition[],
  categoryId: string,
): RawSettingDefinition[] {
  const normalizedCategoryId = normalizeGuid(categoryId);
  return definitions.filter(
    (definition) =>
      definition.categoryId &&
      normalizeGuid(definition.categoryId) === normalizedCategoryId,
  );
}

function paginate<T>(
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

async function fetchSettingValues(
  client: AprimoClient,
  names: string[],
  scope?: SettingScope,
  scopeId?: string,
): Promise<SettingValueSummary[]> {
  validateScopeParams(scope, scopeId);

  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) {
    throw new Error("Provide at least one setting name");
  }

  const scopeQuery = buildScopeQuery(scope, scopeId);

  if (uniqueNames.length === 1) {
    const raw = await client.get<RawSetting>(
      `/api/core/setting/${encodeURIComponent(uniqueNames[0])}${scopeQuery}`,
    );

    return [
      {
        name: raw.name ?? uniqueNames[0],
        value: asString(raw.value),
        scope: scope ?? null,
        scopeId: scopeId?.trim() ? normalizeGuid(scopeId.trim()) : null,
      },
    ];
  }

  const namesQuery = `names=${encodeURIComponent(uniqueNames.join(","))}`;
  const separator = scopeQuery ? "&" : "?";
  const url = `/api/core/settings${scopeQuery}${scopeQuery ? separator : "?"}${namesQuery}`;

  const response = await client.get<SettingCollection>(url);
  const items = response.items ?? [];

  return uniqueNames.map((name) => {
    const match = items.find((item) => item.name === name);
    return {
      name,
      value: asString(match?.value),
      scope: scope ?? null,
      scopeId: scopeId?.trim() ? normalizeGuid(scopeId.trim()) : null,
    };
  });
}

async function attachDefinitions(
  client: AprimoClient,
  settings: SettingValueSummary[],
): Promise<SettingValueSummary[]> {
  const definitions = await listAllSettingDefinitions(client);
  const byName = new Map(
    definitions
      .filter((definition) => definition.name)
      .map((definition) => [definition.name!.toLocaleLowerCase(), definition]),
  );

  return settings.map((setting) => {
    const raw = byName.get(setting.name.toLocaleLowerCase());
    if (!raw) {
      return setting;
    }

    return {
      ...setting,
      definition: mapSettingDefinition(raw),
    };
  });
}

function buildListDefinitionsResponse(
  definitions: RawSettingDefinition[],
  options?: {
    categoryId?: string;
    page?: number;
    pageSize?: number;
  },
): SearchSettingsResponse {
  let filtered = definitions;

  if (options?.categoryId?.trim()) {
    filtered = filterByCategory(filtered, options.categoryId.trim());
  }

  const paginated = paginate(filtered, options?.page, options?.pageSize);

  return {
    matchCount: filtered.length,
    matchedBy: "list",
    ...(options?.categoryId ? { categoryId: normalizeGuid(options.categoryId) } : {}),
    page: paginated.page,
    pageSize: paginated.pageSize,
    totalCount: filtered.length,
    definitions: paginated.items.map(mapSettingDefinition),
  };
}

export async function searchSettings(
  client: AprimoClient,
  params: SearchSettingsParams,
): Promise<SearchSettingsResponse> {
  const query = params.query?.trim();
  const names = params.names?.map((name) => name.trim()).filter(Boolean);
  const scope = params.scope;
  const scopeId = params.scopeId?.trim();
  const categoryId = params.categoryId?.trim();
  const includeDefinition = params.includeDefinition === true;

  if (scope && !isSettingScope(scope)) {
    throw new Error(
      `Invalid scope "${scope}". Use system, user, usergroup, or site.`,
    );
  }

  if (names && names.length > 0) {
    let settings = await fetchSettingValues(client, names, scope, scopeId);

    if (includeDefinition) {
      settings = await attachDefinitions(client, settings);
    }

    return {
      matchCount: settings.length,
      matchedBy: "names",
      ...(scope ? { scope } : {}),
      ...(scopeId ? { scopeId: normalizeGuid(scopeId) } : {}),
      settings,
    };
  }

  if (query && isGuid(query)) {
    const definition = await getSettingDefinitionById(client, query);

    let settings: SettingValueSummary[] | undefined;
    if (definition.name) {
      try {
        settings = await fetchSettingValues(
          client,
          [definition.name],
          scope,
          scopeId,
        );
        if (includeDefinition) {
          settings = settings.map((setting) => ({ ...setting, definition }));
        }
      } catch {
        settings = undefined;
      }
    }

    return {
      matchCount: 1,
      matchedBy: "id",
      ...(scope ? { scope } : {}),
      ...(scopeId ? { scopeId: normalizeGuid(scopeId) } : {}),
      definitions: [definition],
      ...(settings ? { settings } : {}),
    };
  }

  if (query) {
    try {
      let settings = await fetchSettingValues(client, [query], scope, scopeId);

      if (includeDefinition) {
        settings = await attachDefinitions(client, settings);
      }

      return {
        matchCount: settings.length,
        matchedBy: "name",
        ...(scope ? { scope } : {}),
        ...(scopeId ? { scopeId: normalizeGuid(scopeId) } : {}),
        settings,
      };
    } catch {
      const allDefinitions = await listAllSettingDefinitions(client);
      const exactMatches = findDefinitionByName(allDefinitions, query);

      if (exactMatches.length > 0) {
        return {
          ...buildListDefinitionsResponse(exactMatches, {
            categoryId,
            page: params.page,
            pageSize: params.pageSize,
          }),
          matchedBy: "name",
        };
      }

      const partialMatches = findDefinitionsByPartialName(allDefinitions, query);
      if (partialMatches.length === 0) {
        throw new Error(
          `No DAM setting or setting definition found matching "${query}"`,
        );
      }

      return {
        ...buildListDefinitionsResponse(partialMatches, {
          categoryId,
          page: params.page,
          pageSize: params.pageSize,
        }),
        matchedBy: "name",
      };
    }
  }

  const allDefinitions = await listAllSettingDefinitions(client);
  return buildListDefinitionsResponse(allDefinitions, {
    categoryId,
    page: params.page,
    pageSize: params.pageSize,
  });
}
