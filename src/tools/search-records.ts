import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import type { AprimoConfig } from "../config.js";
import { searchRecords } from "../aprimo/search.js";

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
        "Aprimo record ID or GUID to look up directly. Returns id, title, status, and thumbnail only unless metadata is explicitly requested.",
      ),
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
  .refine((data) => Boolean(data.query?.trim() || data.recordId?.trim()), {
    message: "Provide query or recordId",
  });

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
        "Search Aprimo DAM records by keyword or look up a record by recordId / 32-character hex GUID. By default returns only id, title, status, and thumbnail. Do NOT fetch full metadata unless the user explicitly asks — if they look up a record without specifying metadata, ask whether they want full metadata (includeAllMetadata=true) or specific fields (metadataFields). A 32-character hex value in query is treated as a record ID.",
      inputSchema: searchRecordsSchema,
    },
    async ({ query, recordId, metadataFields, includeAllMetadata, page, pageSize }) => {
      try {
        const results = await searchRecords(client, config, {
          query,
          recordId,
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
