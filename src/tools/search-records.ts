import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import type { AprimoConfig } from "../config.js";
import { searchRecords } from "../aprimo/search.js";

const searchRecordsSchema = z.object({
  query: z.string().min(1).describe("Keyword to search indexed Aprimo fields"),
  page: z.number().int().min(1).optional().describe("1-based page number (default: 1)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Results per page (default: 25, max: 100)"),
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
        "Search Aprimo DAM records by keyword across configured indexed fields. Returns record IDs, titles, status, and thumbnail URLs.",
      inputSchema: searchRecordsSchema,
    },
    async ({ query, page, pageSize }) => {
      try {
        const results = await searchRecords(client, config, { query, page, pageSize });

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
