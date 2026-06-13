import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  recommendApiRoutes,
  type ApiRouteCategory,
} from "../aprimo/api-routes.js";

const categoryValues = [
  "auth",
  "records",
  "search",
  "classifications",
  "fields",
  "files",
  "orders",
  "collections",
  "general",
] as const satisfies readonly ApiRouteCategory[];

const recommendApiRouteSchema = z.object({
  useCase: z
    .string()
    .min(3)
    .describe(
      "Natural-language question or goal, e.g. 'How do I download the original file?' or 'Get CDN link for an asset'",
    ),
  category: z
    .enum(categoryValues)
    .optional()
    .describe(
      "Optional filter: auth, records, search, classifications, fields, files, orders, collections, or general",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum number of route recommendations to return (default: 3)"),
});

export function registerRecommendApiRouteTool(server: McpServer): void {
  server.registerTool(
    "recommend_aprimo_api_route",
    {
      title: "Recommend Aprimo DAM API Route",
      description:
        "Aprimo DAM (Digital Asset Management) only. Recommend which DAM REST API route to use at {tenant}.dam.aprimo.com/api/core — search, metadata, download orders, public CDN, file retrieval. Not for Marketing Operations or other Aprimo products. Returns method, path, headers, examples, and documentation links. Does not call Aprimo.",
      inputSchema: recommendApiRouteSchema,
    },
    async ({ useCase, category, limit }) => {
      try {
        const results = recommendApiRoutes({ useCase, category, limit });

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
            : "Unknown API route recommendation error";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to recommend Aprimo API route: ${message}`,
            },
          ],
        };
      }
    },
  );
}
