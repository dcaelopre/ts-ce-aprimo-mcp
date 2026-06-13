import {
  APRIMO_DAM_BASE_URL_PATTERN,
  APRIMO_DAM_SCOPE,
  getDamOutOfScopeNote,
} from "./scope.js";

export type ApiRouteCategory =
  | "auth"
  | "records"
  | "search"
  | "classifications"
  | "fields"
  | "files"
  | "orders"
  | "collections"
  | "general";

export interface AprimoApiRoute {
  id: string;
  name: string;
  category: ApiRouteCategory;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  useCases: string[];
  keywords: string[];
  requiredHeaders?: Record<string, string>;
  optionalHeaders?: Record<string, string>;
  queryParams?: string[];
  requestBodyExample?: string;
  responseNotes?: string;
  relatedMcpTool?: string;
  relatedRouteIds?: string[];
  documentationUrl: string;
}

const BASE_URL = "https://{tenant}.dam.aprimo.com";
const DOCS_BASE = "https://developers-api.aprimo.com";

export const APRIMO_API_ROUTES: AprimoApiRoute[] = [
  {
    id: "oauth-token",
    name: "OAuth client credentials token",
    category: "auth",
    method: "POST",
    path: "https://{tenant}.aprimo.com/login/connect/token",
    summary:
      "Obtain a bearer access token for all Aprimo API calls using client ID and secret.",
    useCases: [
      "authenticate to Aprimo",
      "get access token",
      "connect to the API",
      "authorize REST requests",
    ],
    keywords: [
      "oauth",
      "token",
      "auth",
      "authentication",
      "client credentials",
      "bearer",
      "login",
    ],
    requestBodyExample:
      "grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}&scope=api",
    responseNotes:
      "OAuth token for Aprimo DAM API access only (scope=api). DAM REST calls use https://{tenant}.dam.aprimo.com/api/core. Use Authorization: Bearer {access_token} with API-VERSION: 1 and Accept: application/hal+json.",
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "search-records",
    name: "Search records",
    category: "search",
    method: "POST",
    path: "/api/core/search/records",
    summary:
      "Find assets/records by keyword, search expression, status, content type, classification, and sort. Primary endpoint for discovery.",
    useCases: [
      "search for assets",
      "find records by keyword",
      "filter released assets",
      "search by content type",
      "search by classification",
      "list assets matching criteria",
      "advanced record query",
    ],
    keywords: [
      "search",
      "find",
      "query",
      "keyword",
      "filter",
      "assets",
      "records",
      "expression",
      "contentstatus",
      "contenttype",
      "classification",
      "sort",
      "pagination",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "Content-Type": "application/json",
    },
    optionalHeaders: {
      "select-record":
        "title,thumbnail,status,contentType,createdOn,modifiedOn (basic) or add fields for metadata",
      languages: "* (when requesting field values)",
    },
    queryParams: ["page", "pageSize", "sort"],
    requestBodyExample: JSON.stringify(
      {
        searchExpression: {
          expression:
            "(Keywords CONTAINS 'logo' OR LatestVersionOfMasterfile.FileName CONTAINS 'logo') AND ContentStatus = 'Released'",
        },
      },
      null,
      2,
    ),
    responseNotes:
      "Returns paginated record summaries. Use select-record headers to control embedded data. For a known record ID, GET /record/{id} is often simpler.",
    relatedMcpTool: "search_records",
    relatedRouteIds: ["get-record", "get-record-fields"],
    documentationUrl: `${DOCS_BASE}/#33d066f8-3670-45a3-8df6-69739fef7446`,
  },
  {
    id: "get-record",
    name: "Get record by ID",
    category: "records",
    method: "GET",
    path: "/api/core/record/{recordId}",
    summary:
      "Retrieve a single record/asset when you already know its ID or GUID.",
    useCases: [
      "get record by id",
      "fetch one asset",
      "lookup record details",
      "read title status thumbnail",
      "get asset metadata with select headers",
    ],
    keywords: [
      "record",
      "asset",
      "id",
      "guid",
      "get",
      "fetch",
      "retrieve",
      "single",
      "by id",
      "details",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
    },
    optionalHeaders: {
      "select-record":
        "title,status,thumbnail,contentType,createdOn,modifiedOn,fields,masterfilelatestversion",
      "select-fileversion": "renditions",
      "select-rendition": "publiclinks",
      languages: "*",
    },
    responseNotes:
      "Use select-record to embed fields, file versions, renditions, and public CDN links without extra round trips.",
    relatedMcpTool: "search_records",
    relatedRouteIds: ["get-record-fields", "search-records"],
    documentationUrl: `${DOCS_BASE}/#707b19c8-11c7-4e23-a1bd-22e0c944f2cb`,
  },
  {
    id: "get-record-fields",
    name: "Get record field values",
    category: "records",
    method: "GET",
    path: "/api/core/record/{recordId}/fields",
    summary:
      "Read custom metadata field values for a record when they are not embedded on the record GET response.",
    useCases: [
      "get metadata fields",
      "read custom fields",
      "field values for a record",
      "extract metadata",
      "localized field values",
    ],
    keywords: [
      "fields",
      "metadata",
      "custom fields",
      "values",
      "localized",
      "attributes",
      "properties",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "select-record": "fields",
      languages: "*",
    },
    responseNotes:
      "Prefer GET /record/{id} with select-record: fields when possible. Use this sub-resource as a fallback.",
    relatedMcpTool: "search_records",
    relatedRouteIds: ["get-record", "list-field-definitions"],
    documentationUrl: `${DOCS_BASE}/#707b19c8-11c7-4e23-a1bd-22e0c944f2cb`,
  },
  {
    id: "search-classifications",
    name: "Search classifications",
    category: "search",
    method: "POST",
    path: "/api/core/search/classifications",
    summary:
      "Find taxonomy/classification nodes by name or identifier expression.",
    useCases: [
      "search taxonomy",
      "find classification by name",
      "lookup category",
      "search folder structure",
      "find classification nodes",
    ],
    keywords: [
      "classification",
      "taxonomy",
      "category",
      "folder",
      "search",
      "name",
      "identifier",
      "tree",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "Content-Type": "application/json",
    },
    optionalHeaders: {
      "select-classification": "parent,children",
      languages: "*",
    },
    queryParams: ["page", "pageSize"],
    requestBodyExample: JSON.stringify(
      {
        searchExpression: {
          expression: "Name CONTAINS 'Marketing' OR Identifier CONTAINS 'MKT'",
        },
      },
      null,
      2,
    ),
    relatedMcpTool: "search_classifications",
    relatedRouteIds: ["get-classification", "list-classifications"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "get-classification",
    name: "Get classification by ID",
    category: "classifications",
    method: "GET",
    path: "/api/core/classification/{classificationId}",
    summary:
      "Retrieve one taxonomy node, optionally with parent and child nodes embedded.",
    useCases: [
      "get classification by id",
      "read taxonomy node",
      "classification details",
      "get parent or children",
    ],
    keywords: [
      "classification",
      "taxonomy",
      "category",
      "node",
      "parent",
      "children",
      "hierarchy",
    ],
    optionalHeaders: {
      "select-classification": "parent,children",
      languages: "*",
    },
    relatedMcpTool: "search_classifications",
    relatedRouteIds: ["classification-children", "search-classifications"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "classification-children",
    name: "List classification children",
    category: "classifications",
    method: "GET",
    path: "/api/core/classification/{classificationId}/children",
    summary:
      "List direct child classifications under a parent taxonomy node.",
    useCases: [
      "list child categories",
      "browse taxonomy tree",
      "get subcategories",
      "children of a classification",
    ],
    keywords: [
      "children",
      "child",
      "subcategory",
      "subcategories",
      "browse",
      "tree",
      "hierarchy",
      "parent",
    ],
    queryParams: ["page", "pageSize"],
    optionalHeaders: { languages: "*" },
    relatedMcpTool: "search_classifications",
    relatedRouteIds: ["get-classification", "list-classifications"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "list-classifications",
    name: "List all classifications",
    category: "classifications",
    method: "GET",
    path: "/api/core/classifications",
    summary:
      "Paginated list of all classification nodes when you need the full taxonomy catalog.",
    useCases: [
      "list all classifications",
      "export taxonomy",
      "enumerate categories",
      "full taxonomy list",
    ],
    keywords: [
      "list",
      "all",
      "classifications",
      "taxonomy",
      "catalog",
      "enumerate",
    ],
    queryParams: ["page", "pageSize"],
    optionalHeaders: { languages: "*" },
    relatedMcpTool: "search_classifications",
    relatedRouteIds: ["search-classifications", "get-classification"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "list-field-definitions",
    name: "List field definitions",
    category: "fields",
    method: "GET",
    path: "/api/core/fielddefinitions",
    summary:
      "List metadata field schema definitions (names, labels, data types, validation).",
    useCases: [
      "list field definitions",
      "schema of custom fields",
      "what fields exist",
      "field data types",
      "metadata schema",
    ],
    keywords: [
      "field definitions",
      "schema",
      "metadata schema",
      "datatype",
      "custom fields",
      "list fields",
      "attributes",
    ],
    queryParams: ["page", "pageSize"],
    relatedMcpTool: "search_field_definitions",
    relatedRouteIds: ["get-field-definition"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "get-field-definition",
    name: "Get field definition by ID",
    category: "fields",
    method: "GET",
    path: "/api/core/fielddefinition/{fieldDefinitionId}",
    summary:
      "Retrieve one field definition when you know its GUID, including type-specific configuration.",
    useCases: [
      "get field definition by id",
      "field schema details",
      "option list configuration",
      "validation rules for a field",
    ],
    keywords: [
      "field definition",
      "field id",
      "schema",
      "validation",
      "option list",
      "datatype",
    ],
    relatedMcpTool: "search_field_definitions",
    relatedRouteIds: ["list-field-definitions", "get-record-fields"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "record-renditions-publiclinks",
    name: "Get renditions and public links via record select headers",
    category: "files",
    method: "GET",
    path: "/api/core/record/{recordId}",
    summary:
      "Download URLs, thumbnails, and CDN public links by expanding file versions and renditions on a record GET.",
    useCases: [
      "download asset file",
      "get public link",
      "cdn url",
      "thumbnail url",
      "rendition",
      "image url",
      "file download",
      "master file",
      "preview",
    ],
    keywords: [
      "download",
      "file",
      "rendition",
      "public link",
      "cdn",
      "url",
      "thumbnail",
      "binary",
      "media",
      "masterfile",
      "preview",
    ],
    optionalHeaders: {
      "select-record": "masterfilelatestversion,thumbnail",
      "select-fileversion": "renditions",
      "select-rendition": "publiclinks",
    },
    responseNotes:
      "Best for existing public CDN links and embedded rendition metadata. For downloading the actual binary (original or transformed), use POST /orders (download order) then poll GET /order/{id}.",
    relatedRouteIds: ["get-record", "create-download-order", "create-public-cdn-order"],
    documentationUrl: "https://developers.aprimo.com/docs/rest-api/dam/select-headers",
  },
  {
    id: "create-download-order",
    name: "Create download order",
    category: "orders",
    method: "POST",
    path: "/api/core/orders",
    summary:
      "Start an async download order to retrieve binary files (master file, previews, thumbnails, additional files), optionally with resize/crop/transcode actions.",
    useCases: [
      "download asset file",
      "download binary",
      "get original file",
      "download master file",
      "resize image on download",
      "transcode video download",
      "export asset for integration",
      "download additional file",
      "download order",
    ],
    keywords: [
      "download",
      "order",
      "binary",
      "file",
      "master file",
      "original",
      "asset",
      "async",
      "deliveredfiles",
      "resize",
      "crop",
      "transcode",
      "preview",
      "thumbnail",
      "additional file",
      "document",
      "targettypes",
      "assettype",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "Content-Type": "application/json",
      "User-Agent": "{clientName}",
    },
    requestBodyExample: JSON.stringify(
      {
        type: "download",
        disableNotification: "true",
        disableProcessing: "yes",
        targets: [
          {
            recordId: "{recordId}",
            targetTypes: ["Document"],
            assetType: "LatestVersionOfMasterFile",
          },
        ],
      },
      null,
      2,
    ),
    responseNotes:
      'Returns 201 with Location: /order/{id}. Flow: POST /orders → poll GET /order/{id} until status is Success → download URIs from deliveredFiles. Set disableProcessing to "yes" for fast unprocessed originals (requires "Disable file processing of download orders" permission; one file per order recommended). Other order types on same endpoint: email, ftp, ftpResort, publicCdn. Target types: Document, MasterPreview, MasterThumbnail, AdditionalFiles. Actions: resizeImage, cropImage, transcodeVideo, createPackage, updateXmpMetadata.',
    relatedRouteIds: ["get-order", "download-file-uri", "get-record"],
    documentationUrl: "https://{tenant}.dam.aprimo.com/api/core/docs/resources/ordercollection.html",
  },
  {
    id: "create-download-order-bulk",
    name: "Create bulk download order (recordIds)",
    category: "orders",
    method: "POST",
    path: "/api/core/orders",
    summary:
      "Submit a download order for many records without preloading/validating them at creation time. Records load when the order executes.",
    useCases: [
      "bulk download",
      "mass download",
      "download many records",
      "batch download assets",
      "download order without preload",
    ],
    keywords: [
      "bulk",
      "mass",
      "batch",
      "many",
      "recordids",
      "multiple",
      "download order",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "Content-Type": "application/json",
    },
    requestBodyExample: JSON.stringify(
      {
        type: "download",
        disableNotification: "true",
        targets: [
          {
            recordIds: ["{recordId1}", "{recordId2}"],
            targetTypes: ["Document"],
            assetType: "LatestVersionOfMasterFile",
            filter: { extensions: ["jpg", "png"] },
          },
        ],
      },
      null,
      2,
    ),
    responseNotes:
      "Use recordIds (array) instead of recordId. No validation at creation — invalid IDs fail at execution. recordIds only supports targetTypes Document, AdditionalFiles, and/or Renditions with assetType LatestVersionOfMasterFile. Optional filter.extensions or filter.filename.",
    relatedRouteIds: ["create-download-order", "get-order"],
    documentationUrl: "https://{tenant}.dam.aprimo.com/api/core/docs/resources/ordercollection.html#mass-download-order",
  },
  {
    id: "get-order",
    name: "Get download order status",
    category: "orders",
    method: "GET",
    path: "/api/core/order/{orderId}",
    summary:
      "Poll an order until processing completes and deliveredFiles contains download URIs. Required after POST /orders.",
    useCases: [
      "poll download order",
      "check order status",
      "follow up on order",
      "wait for download to complete",
      "get delivered files",
      "order status executing success failed",
    ],
    keywords: [
      "order",
      "status",
      "poll",
      "follow up",
      "executing",
      "success",
      "failed",
      "deliveredfiles",
      "maintenance job",
      "viewmaintenancejobs",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "User-Agent": "{clientName}",
    },
    responseNotes:
      'Orders are async (service bus). Poll until status is Success, Failed, or PartiallyFailed. deliveredFiles lists ready files when complete. Caller needs ViewMaintenanceJobs role. Status values include Pending, Executing, Success, Failed, PartiallyFailed, Cancelled.',
    relatedRouteIds: ["create-download-order", "download-file-uri"],
    documentationUrl: "https://{tenant}.dam.aprimo.com/api/core/docs/resources/downloadorder.html",
  },
  {
    id: "download-file-uri",
    name: "Download file from order URI",
    category: "orders",
    method: "GET",
    path: "{uri from order deliveredFiles or Image resource}",
    summary:
      "Fetch the actual file bytes using the time-limited URI returned after an order completes (or from an Image resource).",
    useCases: [
      "download file from uri",
      "fetch binary from delivered files",
      "get file content",
      "cdn redirect download",
      "save asset to disk",
    ],
    keywords: [
      "download",
      "uri",
      "binary",
      "content",
      "redirect",
      "cdn",
      "content-disposition",
      "filename",
      "deliveredfiles",
      "blob",
    ],
    optionalHeaders: {
      "Location-Alias": "us1 | eu2 | au1 | cn1 (optional CDN region)",
    },
    responseNotes:
      "GET the URI from deliveredFiles. Response is file content or 301/302 redirect when CDN is enabled. Content-Disposition header contains filename. Token expiry: ~30 hours on disk storage; on Azure blob, controlled by .minimumAvailableTimeForOrders setting. Filename may change when resize actions were applied.",
    relatedRouteIds: ["get-order", "create-download-order"],
    documentationUrl: "https://{tenant}.dam.aprimo.com/api/core/docs/index.html#downloading-files",
  },
  {
    id: "create-public-cdn-order",
    name: "Create public CDN order",
    category: "orders",
    method: "POST",
    path: "/api/core/orders",
    summary:
      "Create or refresh a public CDN link for a record's master file, optionally with resize/transform via renditionName.",
    useCases: [
      "create public cdn link",
      "public link order",
      "cdn url for asset",
      "share asset via cdn",
      "publish asset link",
    ],
    keywords: [
      "public cdn",
      "public link",
      "cdn",
      "share",
      "publish",
      "order",
      "renditionname",
    ],
    requiredHeaders: {
      Authorization: "Bearer {token}",
      "API-VERSION": "1",
      Accept: "application/hal+json",
      "Content-Type": "application/json",
    },
    requestBodyExample: JSON.stringify(
      {
        type: "publicCdn",
        targets: [
          {
            recordId: "{recordId}",
            renditionName: "downloadResizedPng",
            actions: [
              {
                action: "resizeImage",
                parameters: {
                  width: -1,
                  height: -1,
                  format: "png",
                  resolution: -1,
                  colorSpace: "RGB",
                  useAlphaTransparency: "true",
                },
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    responseNotes:
      "Alternative to reading existing publiclinks via GET /record/{id}. Use when you need to generate a new CDN link with transforms. Can target additionalFileId for specific additional files.",
    relatedRouteIds: ["record-renditions-publiclinks", "create-download-order"],
    documentationUrl: "https://{tenant}.dam.aprimo.com/api/core/docs/resources/ordercollection.html#example-public-cdn-order",
  },
  {
    id: "create-record",
    name: "Create record",
    category: "records",
    method: "POST",
    path: "/api/core/record",
    summary:
      "Create a new DAM record/asset. Requires write permissions and typically a multi-step upload flow for binaries.",
    useCases: [
      "upload asset",
      "create new record",
      "ingest file",
      "add asset to dam",
      "create content",
    ],
    keywords: [
      "create",
      "upload",
      "ingest",
      "new record",
      "post",
      "add asset",
      "import",
    ],
    responseNotes:
      "Binary upload usually involves creating a record, uploading to a file upload endpoint, and attaching the master file. Confirm the latest upload flow in official docs for your tenant version.",
    relatedRouteIds: ["get-record", "search-records"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "update-record",
    name: "Update record",
    category: "records",
    method: "PUT",
    path: "/api/core/record/{recordId}",
    summary:
      "Update record properties or metadata. Requires appropriate write permissions.",
    useCases: [
      "update record metadata",
      "change title",
      "modify asset",
      "edit fields",
      "patch record",
    ],
    keywords: [
      "update",
      "edit",
      "modify",
      "put",
      "patch",
      "change metadata",
      "write",
    ],
    relatedRouteIds: ["get-record", "get-record-fields"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "list-collections",
    name: "List collections",
    category: "collections",
    method: "GET",
    path: "/api/core/collections",
    summary:
      "List curated collections of records when your tenant uses Aprimo collections.",
    useCases: [
      "list collections",
      "get curated sets",
      "collection membership",
      "browse collections",
    ],
    keywords: [
      "collection",
      "collections",
      "curated",
      "set",
      "group",
      "album",
    ],
    queryParams: ["page", "pageSize"],
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
  },
  {
    id: "select-headers-guide",
    name: "Aprimo select headers (response shaping)",
    category: "general",
    method: "GET",
    path: "(request header, not a URL path)",
    summary:
      "Control which sub-resources are embedded in responses using Select-{Resource} headers (e.g. select-record, select-classification).",
    useCases: [
      "what headers to use",
      "select headers",
      "expand response",
      "include related data",
      "reduce api calls",
      "hal+json embedded resources",
    ],
    keywords: [
      "select",
      "headers",
      "select-record",
      "select-classification",
      "expand",
      "embed",
      "subresource",
      "hal",
    ],
    responseNotes:
      'Format: "select-record": "fields,title,thumbnail,masterfilelatestversion". Combine with select-fileversion and select-rendition for files and CDN links.',
    relatedRouteIds: ["get-record", "search-records"],
    documentationUrl: "https://developers.aprimo.com/docs/rest-api/dam/select-headers",
  },
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "and",
  "or",
  "is",
  "are",
  "be",
  "can",
  "i",
  "we",
  "my",
  "me",
  "how",
  "what",
  "which",
  "should",
  "use",
  "using",
  "do",
  "does",
  "api",
  "route",
  "endpoint",
  "aprimo",
  "dam",
]);

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreRoute(route: AprimoApiRoute, useCase: string, tokens: string[]): number {
  const normalizedUseCase = useCase.toLocaleLowerCase();
  let score = 0;

  for (const phrase of route.useCases) {
    const normalizedPhrase = phrase.toLocaleLowerCase();
    if (normalizedUseCase.includes(normalizedPhrase)) {
      score += 12;
    }
  }

  for (const keyword of route.keywords) {
    const normalizedKeyword = keyword.toLocaleLowerCase();
    if (normalizedUseCase.includes(normalizedKeyword)) {
      score += 5;
    }
  }

  for (const token of tokens) {
    if (route.keywords.some((keyword) => keyword.toLocaleLowerCase().includes(token))) {
      score += 3;
    }

    if (route.useCases.some((phrase) => phrase.toLocaleLowerCase().includes(token))) {
      score += 2;
    }

    if (route.name.toLocaleLowerCase().includes(token)) {
      score += 2;
    }

    if (route.path.toLocaleLowerCase().includes(token)) {
      score += 1;
    }

    if (route.summary.toLocaleLowerCase().includes(token)) {
      score += 1;
    }
  }

  return score;
}

export interface RecommendApiRouteParams {
  useCase: string;
  category?: ApiRouteCategory;
  limit?: number;
}

export interface RecommendedApiRoute {
  score: number;
  route: AprimoApiRoute;
  fullUrlExample: string;
  relatedRoutes: AprimoApiRoute[];
  recommendation: string;
}

export interface RecommendApiRoutesResponse {
  useCase: string;
  scope: string;
  apiBase: string;
  baseUrlPattern: string;
  documentationUrl: string;
  matchCount: number;
  recommendations: RecommendedApiRoute[];
  hint?: string;
  outOfScopeNote?: string;
}

function buildRecommendation(route: AprimoApiRoute): string {
  const parts = [`Use ${route.method} ${route.path} — ${route.summary}`];

  if (
    route.id === "create-download-order" ||
    route.id === "create-download-order-bulk"
  ) {
    parts.push(
      "Typical flow: POST /orders → poll GET /order/{id} until Success → GET URI from deliveredFiles.",
    );
  }

  if (route.relatedMcpTool) {
    parts.push(
      `This MCP server already exposes "${route.relatedMcpTool}" for live queries against your tenant.`,
    );
  }

  return parts.join(" ");
}

function resolveRelatedRoutes(route: AprimoApiRoute): AprimoApiRoute[] {
  if (!route.relatedRouteIds?.length) {
    return [];
  }

  const byId = new Map(APRIMO_API_ROUTES.map((entry) => [entry.id, entry]));

  return route.relatedRouteIds
    .map((id) => byId.get(id))
    .filter((entry): entry is AprimoApiRoute => Boolean(entry));
}

export function recommendApiRoutes(
  params: RecommendApiRouteParams,
): RecommendApiRoutesResponse {
  const useCase = params.useCase.trim();
  if (!useCase) {
    throw new Error("Describe the use case or question in the useCase parameter");
  }

  const limit = Math.min(Math.max(params.limit ?? 3, 1), 10);
  const tokens = tokenize(useCase);

  let candidates = APRIMO_API_ROUTES;
  if (params.category) {
    candidates = candidates.filter((route) => route.category === params.category);
  }

  const scored = candidates
    .map((route) => ({
      route,
      score: scoreRoute(route, useCase, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const topMatches = scored.slice(0, limit);

  const outOfScopeNote = getDamOutOfScopeNote(useCase);

  if (topMatches.length === 0) {
    const fallback = (params.category
      ? APRIMO_API_ROUTES.filter((route) => route.category === params.category)
      : APRIMO_API_ROUTES
    ).slice(0, limit);

    return {
      useCase,
      scope: APRIMO_DAM_SCOPE,
      apiBase: APRIMO_DAM_BASE_URL_PATTERN,
      baseUrlPattern: `${BASE_URL}/api/core/...`,
      documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
      matchCount: 0,
      recommendations: fallback.map((route) => ({
        score: 0,
        route,
        fullUrlExample: `${BASE_URL}${route.path.startsWith("/") ? route.path : ""}`,
        relatedRoutes: resolveRelatedRoutes(route),
        recommendation: buildRecommendation(route),
      })),
      hint:
        "No strong keyword match. These are common starting routes. Rephrase with verbs like search, get, list, upload, download, or name the resource (record, classification, field, order).",
      ...(outOfScopeNote ? { outOfScopeNote } : {}),
    };
  }

  return {
    useCase,
    scope: APRIMO_DAM_SCOPE,
    apiBase: APRIMO_DAM_BASE_URL_PATTERN,
    baseUrlPattern: `${BASE_URL}/api/core/...`,
    documentationUrl: `${DOCS_BASE}/#0b64aa4b-2033-43c2-913d-338eb75676de`,
    matchCount: topMatches.length,
    recommendations: topMatches.map(({ route, score }) => ({
      score,
      route,
      fullUrlExample: route.path.startsWith("http")
        ? route.path
        : `${BASE_URL}${route.path}`,
      relatedRoutes: resolveRelatedRoutes(route),
      recommendation: buildRecommendation(route),
    })),
    ...(outOfScopeNote ? { outOfScopeNote } : {}),
  };
}
