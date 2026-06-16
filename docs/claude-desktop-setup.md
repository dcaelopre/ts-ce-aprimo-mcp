# Aprimo DAM MCP Server — Claude Desktop Setup

This guide explains how to connect **Claude Desktop** to the shared **Aprimo DAM** MCP server so you can search assets, read metadata, and browse taxonomy from Claude.

**Scope:** Aprimo DAM (Digital Asset Management) only — `{tenant}.dam.aprimo.com`. Not Marketing Operations or other Aprimo products.

---

## What you need

1. **Claude Desktop** installed ([claude.ai/download](https://claude.ai/download))
2. **Node.js 18+** (includes `npx`) — [nodejs.org](https://nodejs.org/)
3. **Aprimo API credentials** for your tenant:
   - Tenant name (e.g. `ps4`)
   - Client ID
   - Client Secret  

   Your Aprimo admin can create these under **Administration → Integration → Registrations**. Each teammate should use **their own** registration where possible.

4. **Access to the shared MCP server URL** (ask your team lead if you don’t have it):

   ```
   https://celopre-aprimo-mcp-dev-dgc6h5hmcnarb9h9.eastus-01.azurewebsites.net/mcp
   ```

---

## Step 1 — Open the Claude Desktop config file

Claude reads MCP servers from a JSON file named `claude_desktop_config.json`. **Each person edits their own copy** on their own computer — you do not share one config file across the team.

### Where is the file?

The path depends on **how Claude was installed** and **which Windows/macOS user** is logged in.

| Install type | Config file path |
|--------------|------------------|
| **Windows (Microsoft Store)** | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |
| **Windows (standard .exe installer)** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |

### What changes per person vs what stays the same

| Part of the path | Same for everyone? | Example |
|------------------|--------------------|---------|
| `%LOCALAPPDATA%` or `%APPDATA%` | **No** — points to *your* Windows user profile | `C:\Users\DianaCarla.Elopre\AppData\Local\...` vs `C:\Users\Alex\AppData\Local\...` |
| `Claude_pzs8sxrjxfjjc` (Store install only) | **Yes** — this is Claude’s Microsoft Store app folder | Same folder name on every PC with Store Claude |
| `claude_desktop_config.json` | **Yes** — same filename everywhere | Each user still has their **own** file in their **own** profile |

So: teammates follow the **same instructions**, but the file lives under **their** user folder. Credentials inside the file are also **personal** (each person pastes their own Client ID and Secret).

### Quick way to open the folder (Windows)

1. Press **Win + R** to open Run.
2. Paste **one** of these and press Enter:

   **Microsoft Store install:**
   ```
   %LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude
   ```

   **Standard install:**
   ```
   %APPDATA%\Claude
   ```

3. Open `claude_desktop_config.json` in that folder (Notepad is fine).

If the Store path does not exist, use the **standard install** path instead.

### If the file doesn’t exist

Create `claude_desktop_config.json` in that folder with:

```json
{
  "mcpServers": {}
}
```

Then continue to Step 2 and add the Aprimo block inside `"mcpServers"`.

---

## Step 2 — Add the Aprimo MCP server

Add (or merge) the block below under `"mcpServers"`. Replace the three credential placeholders with **your** Aprimo values.

```json
{
  "mcpServers": {
    "aprimo-dam": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://celopre-aprimo-mcp-dev-dgc6h5hmcnarb9h9.eastus-01.azurewebsites.net/mcp",
        "--transport",
        "http-only",
        "--header",
        "X-Aprimo-Environment:${APRIMO_ENVIRONMENT}",
        "--header",
        "X-Aprimo-Client-Id:${APRIMO_CLIENT_ID}",
        "--header",
        "X-Aprimo-Client-Secret:${APRIMO_CLIENT_SECRET}"
      ],
      "env": {
        "APRIMO_ENVIRONMENT": "ps4",
        "APRIMO_CLIENT_ID": "paste-your-client-id-here",
        "APRIMO_CLIENT_SECRET": "paste-your-client-secret-here"
      }
    }
  }
}
```

### Field reference

| Setting | Description |
|---------|-------------|
| `APRIMO_ENVIRONMENT` | Aprimo tenant name (the part before `.aprimo.com`), e.g. `ps4` |
| `APRIMO_CLIENT_ID` | From Aprimo Integration → Registrations |
| `APRIMO_CLIENT_SECRET` | Secret for that registration |

Credentials are sent from **your Claude config** to the MCP server on each request. They are **not** stored in the shared Azure app (unless an admin configured fallback env vars for dev).

---

## Step 3 — Restart Claude Desktop

Fully quit Claude Desktop and open it again. MCP servers load at startup.

---

## Step 4 — Verify it works

1. In Claude Desktop, open a **new chat**.
2. Look for the **tools / MCP** indicator (hammer icon or “Search and tools”).
3. You should see **aprimo-dam** connected with tools such as:
   - `search_records` — find assets and read basic info
   - `search_classifications` — browse taxonomy
   - `search_field_definitions` — look up metadata field schema
   - `search_rules` — read DAM automation rules, conditions, and actions
   - `search_settings` — read DAM settings and setting definitions

4. Try a prompt, for example:

   > Search Aprimo for records with “logo” in the title that are Released.

---

## Example prompts

- “Search Aprimo DAM for released images matching ‘brand guidelines’.”
- “Look up classification Marketing under parent ID …”
- “What fields are defined for data type OptionList?”
- “List enabled Record rules”
- “Show me the conditions and actions for rule X”
- “Get record `abc123…` by ID and show title, status, and content type only.”

By default, record search returns **basic fields only** (id, title, status, contentType, dates, thumbnail). Ask Claude explicitly if you need full metadata or specific fields.

---

## Troubleshooting

### Can’t find the config file

- Try **both** Windows paths above (Store vs standard install).
- Confirm Claude Desktop is installed and has been opened at least once.
- On macOS, use Finder → **Go → Go to Folder…** and paste: `~/Library/Application Support/Claude`

### MCP server doesn’t appear in Claude

- Confirm **Node.js** is installed: run `node -v` and `npx -v` in a terminal.
- Check JSON syntax in the config file (no trailing commas).
- Fully **quit and restart** Claude Desktop (not just close the window).
- On first run, `npx` may download `mcp-remote` — allow network access.

### “Missing Aprimo credentials” or 401 errors

- Verify `APRIMO_CLIENT_ID`, `APRIMO_CLIENT_SECRET`, and `APRIMO_ENVIRONMENT` in the `env` block.
- Ensure header args use `${APRIMO_...}` exactly as shown (Claude substitutes from `env`).
- Confirm your Aprimo registration is active and has DAM API access.

### “Aprimo authentication failed”

- Double-check client ID and secret (no extra spaces).
- Confirm the tenant name matches your DAM URL (e.g. `https://ps4.dam.aprimo.com`).
- Ask your Aprimo admin whether the registration has the required permissions.

### Tools connect but searches return nothing

- Your account may lack view rights on those records.
- Try a simpler query or a known record ID.
- Field names in search depend on tenant configuration.

### Still stuck?

- Check the server health endpoint in a browser:  
  `https://celopre-aprimo-mcp-dev-dgc6h5hmcnarb9h9.eastus-01.azurewebsites.net/`  
  You should see `"status": "running"` and `"scope"` describing Aprimo DAM.
- Contact your team admin with the exact error message from Claude.

---

## Security notes

- **Do not** commit `claude_desktop_config.json` or share it with secrets in Slack/email.
- Each person should use **their own** Aprimo client credentials when possible.
- Rotate client secrets in Aprimo if a secret is exposed.
- This server is **read-oriented** for search and guidance; it does not replace Aprimo’s own permission model.

---

## Optional — Cursor IDE

If you use **Cursor** instead of Claude Desktop, add the same server under Cursor MCP settings (Settings → MCP), using the same URL, headers, and env values. The exact UI may differ; ask your team if a Cursor-specific snippet is needed.

---

## Server details (for reference)

| Item | Value |
|------|--------|
| MCP endpoint | `…/mcp` |
| API base | `https://{tenant}.dam.aprimo.com/api/core` |
| Auth | OAuth client credentials (per user via config headers) |
| Source repo | [ts-ce-aprimo-mcp](https://github.com/dcaelopre/ts-ce-aprimo-mcp) |
