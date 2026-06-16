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
  valueAccessible?: boolean;
  accessNote?: string;
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
  note?: string;
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
  _links?: {
    next?: { href?: string };
  };
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

const MAX_DEFINITION_SCAN_PAGES = 50;

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

function buildScopeQuery(scope?: SettingScope, scopeId?: string): string {
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

function isSettingAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Aprimo API error (403)") ||
    error.message.includes("Aprimo API error (404)")
  );
}

function settingAccessNote(error: unknown): string {
  if (error instanceof Error && error.message.includes("Aprimo API error (403)")) {
    return "Setting value is not accessible via REST. It may need to be added to the .rest_SettingsWhitelist system setting, or your account may lack permission.";
  }

  if (error instanceof Error && error.message.includes("Aprimo API error (404)")) {
    return "Setting value was not found at the requested scope. Try another scope or use the exact internal setting name from the definition.";
  }

  return "Setting value could not be read via REST.";
}

export function isSettingScope(value: string): value is SettingScope {
  return SETTING_SCOPE_VALUES.has(value);
}

async function fetchSettingDefinitionsPage(
  client: AprimoClient,
  page: number,
  pageSize: number,
): Promise<SettingDefinitionPage> {
  return client.get<SettingDefinitionPage>("/api/core/settingdefinitions", {
    ...SETTING_DEFINITION_HEADERS,
    page: String(page),
    pageSize: String(pageSize),
  });
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

async function scanSettingDefinitions(
  client: AprimoClient,
  predicate: (definition: RawSettingDefinition) => boolean,
  options?: { categoryId?: string },
): Promise<RawSettingDefinition[]> {
  const matches: RawSettingDefinition[] = [];
  let page = 1;
  const pageSize = 200;

  while (page <= MAX_DEFINITION_SCAN_PAGES) {
    const response = await fetchSettingDefinitionsPage(client, page, pageSize);
    const items = response.items ?? [];

    for (const item of items) {
      if (options?.categoryId?.trim()) {
        const categoryId = asString(item.categoryId);
        if (
          !categoryId ||
          normalizeGuid(categoryId) !== normalizeGuid(options.categoryId.trim())
        ) {
          continue;
        }
      }

      if (predicate(item)) {
        matches.push(item);
      }
    }

    const totalCount = response.totalCount ?? items.length;
    if (!response._links?.next || items.length === 0 || page * pageSize >= totalCount) {
      break;
    }

    page += 1;
  }

  return matches;
}

function findDefinitionsByLabel(
  definitions: RawSettingDefinition[],
  query: string,
  exact = false,
): RawSettingDefinition[] {
  const normalizedQuery = normalizeText(query);

  return definitions.filter((definition) =>
    (definition.labels ?? []).some((entry) => {
      const label = entry.value?.toLocaleLowerCase() ?? "";
      return exact ? label === normalizedQuery : label.includes(normalizedQuery);
    }),
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
        valueAccessible: true,
      },
    ];
  }

  const namesQuery = `names=${encodeURIComponent(uniqueNames.join(","))}`;
  const url = scopeQuery
    ? `/api/core/settings${scopeQuery}&${namesQuery}`
    : `/api/core/settings?${namesQuery}`;

  const response = await client.get<SettingCollection>(url);
  const items = response.items ?? [];

  return uniqueNames.map((name) => {
    const match = items.find((item) => item.name === name);
    return {
      name,
      value: asString(match?.value),
      scope: scope ?? null,
      scopeId: scopeId?.trim() ? normalizeGuid(scopeId.trim()) : null,
      valueAccessible: match !== undefined,
    };
  });
}

async function attachDefinitions(
  client: AprimoClient,
  settings: SettingValueSummary[],
): Promise<SettingValueSummary[]> {
  const namesToFind = new Set(
    settings.map((setting) => setting.name.toLocaleLowerCase()).filter(Boolean),
  );
  const byName = new Map<string, RawSettingDefinition>();

  let page = 1;
  const pageSize = 200;

  while (namesToFind.size > 0 && page <= MAX_DEFINITION_SCAN_PAGES) {
    const response = await fetchSettingDefinitionsPage(client, page, pageSize);
    const items = response.items ?? [];

    for (const definition of items) {
      const name = definition.name?.toLocaleLowerCase();
      if (!name || !namesToFind.has(name)) {
        continue;
      }

      byName.set(name, definition);
      namesToFind.delete(name);
    }

    const totalCount = response.totalCount ?? items.length;
    if (!response._links?.next || items.length === 0 || page * pageSize >= totalCount) {
      break;
    }

    page += 1;
  }

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
  matchedBy: SearchSettingsResponse["matchedBy"],
  options?: {
    categoryId?: string;
    page?: number;
    pageSize?: number;
    totalCount?: number | null;
    note?: string;
  },
): SearchSettingsResponse {
  let filtered = definitions;

  if (options?.categoryId?.trim()) {
    filtered = filterByCategory(filtered, options.categoryId.trim());
  }

  const paginated = paginate(filtered, options?.page, options?.pageSize);

  return {
    matchCount: filtered.length,
    matchedBy,
    ...(options?.categoryId ? { categoryId: normalizeGuid(options.categoryId) } : {}),
    page: paginated.page,
    pageSize: paginated.pageSize,
    totalCount: options?.totalCount ?? filtered.length,
    ...(options?.note ? { note: options.note } : {}),
    definitions: paginated.items.map(mapSettingDefinition),
  };
}

async function findDefinitionsForQuery(
  client: AprimoClient,
  query: string,
  categoryId?: string,
): Promise<RawSettingDefinition[]> {
  const exactNameMatches = await scanSettingDefinitions(
    client,
    (definition) => definition.name?.toLocaleLowerCase() === normalizeText(query),
    { categoryId },
  );
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  const exactLabelMatches = await scanSettingDefinitions(
    client,
    (definition) => findDefinitionsByLabel([definition], query, true).length > 0,
    { categoryId },
  );
  if (exactLabelMatches.length > 0) {
    return exactLabelMatches;
  }

  const partialNameMatches = await scanSettingDefinitions(
    client,
    (definition) =>
      definition.name?.toLocaleLowerCase().includes(normalizeText(query)) === true,
    { categoryId },
  );
  if (partialNameMatches.length > 0) {
    return partialNameMatches;
  }

  return scanSettingDefinitions(
    client,
    (definition) => findDefinitionsByLabel([definition], query, false).length > 0,
    { categoryId },
  );
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
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

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
      } catch (error) {
        settings = [
          {
            name: definition.name,
            value: null,
            scope: scope ?? null,
            scopeId: scopeId ? normalizeGuid(scopeId) : null,
            valueAccessible: false,
            accessNote: settingAccessNote(error),
            definition: includeDefinition ? definition : undefined,
          },
        ];
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
    } catch (valueError) {
      const definitionMatches = await findDefinitionsForQuery(
        client,
        query,
        categoryId,
      );

      if (definitionMatches.length === 0) {
        if (isSettingAccessError(valueError)) {
          throw new Error(
            `${settingAccessNote(valueError)} No setting definition matched "${query}" by internal name or label.`,
          );
        }

        throw valueError;
      }

      const paginated = paginate(definitionMatches, page, pageSize);
      const definitions = paginated.items.map(mapSettingDefinition);

      const settings: SettingValueSummary[] = definitions.map((definition) => ({
        name: definition.name,
        value:
          definition.defaultValue === null || definition.defaultValue === undefined
            ? null
            : String(definition.defaultValue),
        scope: scope ?? null,
        scopeId: scopeId ? normalizeGuid(scopeId) : null,
        valueAccessible: false,
        accessNote: settingAccessNote(valueError),
        ...(includeDefinition ? { definition } : {}),
      }));

      return {
        matchCount: definitionMatches.length,
        matchedBy: "name",
        ...(scope ? { scope } : {}),
        ...(scopeId ? { scopeId: normalizeGuid(scopeId) } : {}),
        ...(categoryId ? { categoryId: normalizeGuid(categoryId) } : {}),
        page: paginated.page,
        pageSize: paginated.pageSize,
        totalCount: definitionMatches.length,
        note:
          "Matched setting definitions by name or label. Live values could not be read via REST; defaultValue is shown when available.",
        definitions,
        settings,
      };
    }
  }

  if (categoryId) {
    const matches = await scanSettingDefinitions(client, () => true, { categoryId });
    return buildListDefinitionsResponse(matches, "list", {
      categoryId,
      page,
      pageSize,
      totalCount: matches.length,
    });
  }

  const response = await fetchSettingDefinitionsPage(client, page, pageSize);
  const items = response.items ?? [];

  return {
    matchCount: items.length,
    matchedBy: "list",
    page: response.page ?? page,
    pageSize: response.pageSize ?? pageSize,
    totalCount: response.totalCount ?? items.length,
    definitions: items.map(mapSettingDefinition),
  };
}
