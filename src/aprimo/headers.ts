/** Aprimo select headers for record GET requests that include field metadata. */
export const RECORD_WITH_METADATA_HEADERS: Record<string, string> = {
  "select-record": "fields,title,status,thumbnail",
  languages: "*",
};

/** Aprimo select header to request only embedded field metadata. */
export const RECORD_FIELDS_HEADERS: Record<string, string> = {
  "select-record": "fields",
  languages: "*",
};

/** Basic record summary without field metadata (keyword search default). */
export const SEARCH_RECORD_BASIC_HEADERS: Record<string, string> = {
  "select-record": "title,thumbnail,status,contentType,createdOn,modifiedOn",
};

/** Record GET by ID without field metadata. */
export const RECORD_SUMMARY_HEADERS: Record<string, string> = {
  "select-record": "title,status,thumbnail,contentType,createdOn,modifiedOn",
};

/** Keyword search with embedded field metadata on each result. */
export const SEARCH_RECORD_WITH_FIELDS_HEADERS: Record<string, string> = {
  "select-record":
    "fields,title,thumbnail,status,contentType,createdOn,modifiedOn",
  languages: "*",
};

/** Classification GET with parent and children embedded. */
export const CLASSIFICATION_WITH_RELATIONS_HEADERS: Record<string, string> = {
  "select-classification": "parent,children",
  languages: "*",
};

/** Classification GET with direct children only. */
export const CLASSIFICATION_WITH_CHILDREN_HEADERS: Record<string, string> = {
  "select-classification": "children",
  languages: "*",
};

/** Classification search results with parent/children context. */
export const SEARCH_CLASSIFICATION_HEADERS: Record<string, string> = {
  "select-classification": "parent,children",
  languages: "*",
};

/** Rule list/summary without conditions or actions. */
export const RULE_SUMMARY_HEADERS: Record<string, string> = {
  "select-rule": "createdby,modifiedby",
};

/** Rule GET with embedded conditions and actions. */
export const RULE_WITH_DETAILS_HEADERS: Record<string, string> = {
  "select-rule": "conditions,actions,createdby,modifiedby",
};

/** Setting definition GET/list with localized labels. */
export const SETTING_DEFINITION_HEADERS: Record<string, string> = {
  languages: "*",
};
