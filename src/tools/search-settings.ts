import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import { searchSettings } from "../aprimo/settings.js";

const settingScopeSchema = z.enum(["system", "user", "usergroup", "site"]);

const searchSettingsSchema = z.object({
  query: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Setting name or definition GUID. Fetches the current value by name, or definition metadata by GUID.",
    ),
  names: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe("Fetch multiple setting values by name in one request."),
  scope: settingScopeSchema
    .optional()
    .describe(
      'Setting scope when reading values: "system", "user", "usergroup", or "site".',
    ),
  scopeId: z
    .string()
    .min(1)
    .optional()
    .describe("Required when scope is usergroup or site."),
  categoryId: z
    .string()
    .min(1)
    .optional()
    .describe("Filter setting definitions by category GUID when browsing."),
  includeDefinition: z
    .boolean()
    .optional()
    .describe(
      "When true, include setting definition metadata (data type, labels, defaults) with value results.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based page number when listing definitions (default: 1)."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Results per page when listing definitions (default: 25, max: 100)."),
});

export function registerSearchSettingsTool(
  server: McpServer,
  client: AprimoClient,
): void {
  server.registerTool(
    "search_settings",
    {
      title: "Search Aprimo DAM Settings",
      description:
        "Read Aprimo DAM settings and setting definitions. Fetch current values by name (single or multiple), look up definition schema by GUID or name, or browse definitions with optional category filter. Supports scope (system, user, usergroup, site). Note: REST access may require settings to be whitelisted in ADAM.",
      inputSchema: searchSettingsSchema,
    },
    async ({
      query,
      names,
      scope,
      scopeId,
      categoryId,
      includeDefinition,
      page,
      pageSize,
    }) => {
      try {
        const results = await searchSettings(client, {
          query,
          names,
          scope,
          scopeId,
          categoryId,
          includeDefinition,
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
          error instanceof Error ? error.message : "Unknown settings search error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to search Aprimo DAM settings: ${message}`,
            },
          ],
        };
      }
    },
  );
}
