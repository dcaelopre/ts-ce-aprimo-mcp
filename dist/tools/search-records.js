import { z } from "zod";
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
export function registerSearchRecordsTool(server, client, config) {
    server.registerTool("search_records", {
        title: "Search Aprimo Records",
        description: "Search Aprimo DAM records by keyword across configured indexed fields. Returns record IDs, titles, status, and thumbnail URLs.",
        inputSchema: searchRecordsSchema,
    }, async ({ query, page, pageSize }) => {
        try {
            const results = await searchRecords(client, config, { query, page, pageSize });
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
            const message = error instanceof Error ? error.message : "Unknown search error";
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Failed to search Aprimo records: ${message}`,
                    },
                ],
            };
        }
    });
}
