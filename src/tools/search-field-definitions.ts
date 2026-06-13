import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import { searchFieldDefinitions } from "../aprimo/field-definitions.js";

const searchFieldDefinitionsSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Field definition GUID, internal name (e.g. MyFieldName), or display label",
      ),
    dataType: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Filter by data type (e.g. SingleLineText, OptionList, Numeric, Date, Html). Case-insensitive.",
      ),
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("1-based page number when listing by data type (default: 1)"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page when listing by data type (default: 25, max: 100)"),
  })
  .refine((value) => value.query || value.dataType, {
    message: "Provide query and/or dataType",
  });

export function registerSearchFieldDefinitionsTool(
  server: McpServer,
  client: AprimoClient,
): void {
  server.registerTool(
    "search_field_definitions",
    {
      title: "Search Aprimo Field Definitions",
      description:
        "Look up Aprimo DAM field definitions only — GUID, internal name, display label, and/or data type. Returns matchCount, data type, required/read-only flags, validation, scope, and type-specific configuration.",
      inputSchema: searchFieldDefinitionsSchema,
    },
    async ({ query, dataType, page, pageSize }) => {
      try {
        const results = await searchFieldDefinitions(client, {
          query,
          dataType,
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
          error instanceof Error ? error.message : "Unknown field definition search error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to search Aprimo field definitions: ${message}`,
            },
          ],
        };
      }
    },
  );
}
