import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTokenProvider } from "./aprimo/auth.js";
import { AprimoClient } from "./aprimo/client.js";
import { loadConfig } from "./config.js";
import { registerSearchFieldDefinitionsTool } from "./tools/search-field-definitions.js";
import { registerSearchRecordsTool } from "./tools/search-records.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const getToken = createTokenProvider(config);
  const aprimoClient = new AprimoClient(config, getToken);

  const server = new McpServer({
    name: "aprimo-mcp-server",
    version: "1.0.0",
  });

  registerSearchRecordsTool(server, aprimoClient, config);
  registerSearchFieldDefinitionsTool(server, aprimoClient);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
