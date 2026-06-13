import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createTokenProvider } from "./aprimo/auth.js";
import { AprimoClient } from "./aprimo/client.js";
import { loadConfig, type AprimoConfig } from "./config.js";
import { registerSearchFieldDefinitionsTool } from "./tools/search-field-definitions.js";
import { registerSearchRecordsTool } from "./tools/search-records.js";

function createMcpServer(
  config: AprimoConfig,
  aprimoClient: AprimoClient,
): McpServer {
  const server = new McpServer({
    name: "aprimo-mcp-server",
    version: "1.0.0",
  });

  registerSearchRecordsTool(server, aprimoClient, config);
  registerSearchFieldDefinitionsTool(server, aprimoClient);

  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const getToken = createTokenProvider(config);
  const aprimoClient = new AprimoClient(config, getToken);

  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send("Aprimo MCP Server is running.");
  });

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(config, aprimoClient);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
        });
      }
    }
  });

  const port = Number(process.env.PORT) || 3000;

  app.listen(port, () => {
    console.log(`Aprimo MCP Server listening on port ${port}`);
  });

  process.on("SIGINT", async () => {
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
