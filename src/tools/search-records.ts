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
        "Aprimo record ID or GUID to look up directly. Returns record details and metadata.",
      ),
    metadataFields: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Optional metadata field names, labels, or GUIDs to read from each record. When using recordId and omitted, all fields are returned.",
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
        "Search Aprimo DAM records by keyword or look up a single record by recordId (32-character hex ID or GUID). Returns record IDs, titles, status, thumbnail URLs, and metadata. When recordId is used, all field metadata is returned unless metadataFields limits the response.",
      inputSchema: searchRecordsSchema,
    },
    async ({ query, recordId, metadataFields, page, pageSize }) => {
      try {
        const results = await searchRecords(client, config, {
          query,
          recordId,
          metadataFields,
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
