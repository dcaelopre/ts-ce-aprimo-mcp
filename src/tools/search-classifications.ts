import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import { searchClassifications } from "../aprimo/classifications.js";

const searchClassificationsSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Classification GUID, internal name, identifier, or display label to search for",
      ),
    parentId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Parent classification GUID. When used alone, returns direct child classifications.",
      ),
    includeChildren: z
      .boolean()
      .optional()
      .describe(
        "When true, includes direct child classifications for matched results.",
      ),
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("1-based page number (default: 1)"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Results per page (default: 25, max: 100)"),
  })
  .refine((value) => value.query || value.parentId, {
    message: "Provide query and/or parentId",
  });

export function registerSearchClassificationsTool(
  server: McpServer,
  client: AprimoClient,
): void {
  server.registerTool(
    "search_classifications",
    {
      title: "Search Aprimo Classifications",
      description:
        "Read Aprimo DAM taxonomy classifications by GUID, name, identifier, or label. Use parentId alone to list direct children of a classification. Returns paths, labels, hierarchy info, and optional child nodes.",
      inputSchema: searchClassificationsSchema,
    },
    async ({ query, parentId, includeChildren, page, pageSize }) => {
      try {
        const results = await searchClassifications(client, {
          query,
          parentId,
          includeChildren,
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
          error instanceof Error
            ? error.message
            : "Unknown classification search error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to search Aprimo classifications: ${message}`,
            },
          ],
        };
      }
    },
  );
}
