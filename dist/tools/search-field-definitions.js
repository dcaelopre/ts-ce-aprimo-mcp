import { z } from "zod";
import { searchFieldDefinitions } from "../aprimo/field-definitions.js";
const searchFieldDefinitionsSchema = z.object({
    query: z
        .string()
        .min(1)
        .describe("Field definition GUID, internal name (e.g. MyFieldName), or display label"),
});
export function registerSearchFieldDefinitionsTool(server, client) {
    server.registerTool("search_field_definitions", {
        title: "Search Aprimo Field Definitions",
        description: "Look up Aprimo DAM field definitions by GUID, internal name, or display label. Returns data type, required/read-only flags, validation, scope, and type-specific configuration.",
        inputSchema: searchFieldDefinitionsSchema,
    }, async ({ query }) => {
        try {
            const results = await searchFieldDefinitions(client, { query });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown field definition search error";
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Failed to search Aprimo field definitions: ${message}`,
                    },
                ],
            };
        }
    });
}
