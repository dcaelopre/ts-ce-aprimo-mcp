import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";

export const APRIMO_CREDENTIAL_HEADERS = {
  environment: "x-aprimo-environment",
  clientId: "x-aprimo-client-id",
  clientSecret: "x-aprimo-client-secret",
} as const;

const configSchema = z.object({
  environment: z.string().min(1, "APRIMO_ENVIRONMENT is required"),
  clientId: z.string().min(1, "APRIMO_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "APRIMO_CLIENT_SECRET is required"),
  searchFields: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "Keywords,LatestVersionOfMasterfile.FileName")
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
    ),
});

export type AprimoConfig = z.infer<typeof configSchema>;

function getHeaderValue(
  headers: IncomingHttpHeaders | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

export class AprimoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AprimoConfigError";
  }
}

export function resolveConfig(headers?: IncomingHttpHeaders): AprimoConfig {
  const environment =
    getHeaderValue(headers, APRIMO_CREDENTIAL_HEADERS.environment) ??
    process.env.APRIMO_ENVIRONMENT;
  const clientId =
    getHeaderValue(headers, APRIMO_CREDENTIAL_HEADERS.clientId) ??
    process.env.APRIMO_CLIENT_ID;
  const clientSecret =
    getHeaderValue(headers, APRIMO_CREDENTIAL_HEADERS.clientSecret) ??
    process.env.APRIMO_CLIENT_SECRET;
  const searchFields = process.env.APRIMO_SEARCH_FIELDS;

  const result = configSchema.safeParse({
    environment,
    clientId,
    clientSecret,
    searchFields,
  });

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join("; ");
    throw new AprimoConfigError(
      `${messages}. Provide credentials via Claude MCP config headers (${APRIMO_CREDENTIAL_HEADERS.environment}, ${APRIMO_CREDENTIAL_HEADERS.clientId}, ${APRIMO_CREDENTIAL_HEADERS.clientSecret}) or server environment variables.`,
    );
  }

  return result.data as AprimoConfig;
}

/** @deprecated Use resolveConfig() so Claude session headers can supply credentials. */
export function loadConfig(): AprimoConfig {
  return resolveConfig();
}
