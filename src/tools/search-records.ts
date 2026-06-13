import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import type { AprimoConfig } from "../config.js";
import { searchRecords } from "../aprimo/search.js";

const recordStatusSchema = z.enum(["Draft", "Released", "Archived"]);

const searchRecordsSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe("Keyword to search indexed Aprimo fields"),
    recordId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Aprimo record ID or GUID to look up directly via GET /record/{id}. Returns basic record info unless metadata is explicitly requested.",
      ),
    searchExpression: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Advanced Aprimo search expression for POST /search/records. When set, overrides the built-in keyword/filter expression.",
      ),
    status: recordStatusSchema
      .optional()
      .describe("Filter by record status (ContentStatus in search expression)"),
    contentType: z
      .string()
      .min(1)
      .optional()
      .describe("Filter by Aprimo content type name"),
    classificationId: z
      .string()
      .min(1)
      .optional()
      .describe("Filter records linked to this classification GUID"),
    sort: z
      .string()
      .min(1)
      .optional()
      .describe("Sort expression for search results, e.g. ModifiedOn desc"),
    metadataFields: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Specific metadata field names, labels, or GUIDs to return. Only use when the user asks for these fields.",
      ),
    includeAllMetadata: z
      .boolean()
      .optional()
      .describe(
        "When true, returns all metadata fields. Only set this when the user explicitly asks for full record metadata.",
      ),
    page: z.number().int().min(1).optional().describe("1-based page number (default: 1)"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page (default: 25, max: 100)"),
  })
  .refine(
    (data) =>
      Boolean(
        data.query?.trim() ||
          data.recordId?.trim() ||
          data.searchExpression?.trim() ||
          data.status ||
          data.contentType?.trim() ||
          data.classificationId?.trim(),
      ),
    {
      message:
        "Provide query, recordId, searchExpression, or at least one filter (status, contentType, classificationId)",
    },
  );

export function registerSearchRecordsTool(
  server: McpServer,
  client: AprimoClient,
  config: AprimoConfig,
): void {
  server.registerTool(
    "search_records",
    {
      title: "Search Aprimo Records",
      description:
        "Search Aprimo DAM records only (POST /search/records or GET /record/{id}). Supports keyword search, searchExpression, status/contentType/classification filters, and sort. By default returns id, title, status, contentType, createdOn, modifiedOn, and thumbnail. Do NOT fetch full metadata unless the user explicitly asks. A 32-character hex value in query is treated as a record ID.",
      inputSchema: searchRecordsSchema,
    },
    async ({
      query,
      recordId,
      searchExpression,
      status,
      contentType,
      classificationId,
      sort,
      metadataFields,
      includeAllMetadata,
      page,
      pageSize,
    }) => {
      try {
        const results = await searchRecords(client, config, {
          query,
          recordId,
          searchExpression,
          status,
          contentType,
          classificationId,
          sort,
          metadataFields,
          includeAllMetadata,
          page,
          pageSize,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown search error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to search Aprimo records: ${message}`,
            },
          ],
        };
      }
    },
  );
}
