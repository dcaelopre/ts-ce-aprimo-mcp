import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AprimoClient } from "../aprimo/client.js";
import { searchRules } from "../aprimo/rules.js";

const ruleTargetSchema = z.enum([
  "SettingDefinition",
  "FieldDefinition",
  "IndexerTask",
  "Translation",
  "SettingCategory",
  "UserGroup",
  "Watermark",
  "FieldGroup",
  "Collection",
  "User",
  "Classification",
  "Record",
  "Language",
  "FileType",
  "Organization",
  "Site",
  "Publication",
  "Subscription",
  "Filestore",
  "SavedView",
]);

const ruleTriggerSchema = z.enum(["WhenSavedOrDeleted", "Daily"]);

const searchRulesSchema = z.object({
  query: z
    .string()
    .min(1)
    .optional()
    .describe("Rule GUID or name to search for. Omit to list rules."),
  target: ruleTargetSchema
    .optional()
    .describe(
      'Filter by rule target object type, e.g. "Record" or "Classification".',
    ),
  enabled: z
    .boolean()
    .optional()
    .describe("Filter by whether the rule is enabled."),
  trigger: ruleTriggerSchema
    .optional()
    .describe('Filter by trigger: "WhenSavedOrDeleted" or "Daily".'),
  includeDetails: z
    .boolean()
    .optional()
    .describe(
      "When true, include rule conditions and actions. Default false for lists.",
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
});

export function registerSearchRulesTool(
  server: McpServer,
  client: AprimoClient,
): void {
  server.registerTool(
    "search_rules",
    {
      title: "Search Aprimo DAM Rules",
      description:
        "Read Aprimo DAM automation rules only — by GUID, name, or filtered list. Returns name, enabled state, target, trigger, expression, version, and counts. Set includeDetails=true to include conditions and actions.",
      inputSchema: searchRulesSchema,
    },
    async ({ query, target, enabled, trigger, includeDetails, page, pageSize }) => {
      try {
        const results = await searchRules(client, {
          query,
          target,
          enabled,
          trigger,
          includeDetails,
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
          error instanceof Error ? error.message : "Unknown rule search error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to search Aprimo DAM rules: ${message}`,
            },
          ],
        };
      }
    },
  );
}
