/** Aprimo DAM API base pattern used by this MCP server. */
export const APRIMO_DAM_BASE_URL_PATTERN =
  "https://{tenant}.dam.aprimo.com/api/core";

export const APRIMO_DAM_SCOPE =
  "Aprimo DAM (Digital Asset Management) only — assets, records, taxonomy, metadata, and file download orders at {tenant}.dam.aprimo.com.";

export const APRIMO_DAM_OUT_OF_SCOPE =
  "Not in scope: Aprimo Marketing Operations, campaign/project APIs, Analytics APIs, or other non-DAM Aprimo products ({tenant}.aprimo.com without .dam).";

const OUT_OF_SCOPE_PATTERN =
  /marketing\s+operations|\bmrm\b|campaign\s+management|\bactivities\b|analytics\s+api|marketing\s+automation|content\s+operations/i;

export function getDamOutOfScopeNote(useCase: string): string | undefined {
  if (!OUT_OF_SCOPE_PATTERN.test(useCase)) {
    return undefined;
  }

  return APRIMO_DAM_OUT_OF_SCOPE;
}
