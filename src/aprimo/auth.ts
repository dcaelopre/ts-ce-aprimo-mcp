import type { AprimoConfig } from "../config.js";

const FALLBACK_TOKEN_TTL_MS = 9 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 30 * 1000;

function getTokenExpiryMs(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return Date.now() + FALLBACK_TOKEN_TTL_MS;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = Buffer.from(padded, "base64").toString("utf8");
    const claims = JSON.parse(json) as { exp?: number };

    if (typeof claims.exp === "number") {
      return claims.exp * 1000;
    }
  } catch {
    // Fall through to default TTL.
  }

  return Date.now() + FALLBACK_TOKEN_TTL_MS;
}

async function fetchAccessToken(config: AprimoConfig): Promise<string> {
  const tokenUrl = `https://${config.environment}.aprimo.com/login/connect/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "api",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Aprimo authentication failed (${response.status}): ${detail}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Aprimo authentication response missing access_token");
  }

  return data.access_token;
}

export function createTokenProvider(config: AprimoConfig): () => Promise<string> {
  let cachedToken: string | null = null;
  let cachedExpiryMs = 0;
  let inflight: Promise<string> | null = null;

  return async () => {
    if (cachedToken && Date.now() < cachedExpiryMs - TOKEN_REFRESH_SKEW_MS) {
      return cachedToken;
    }

    if (inflight) {
      return inflight;
    }

    inflight = (async () => {
      try {
        const token = await fetchAccessToken(config);
        cachedToken = token;
        cachedExpiryMs = getTokenExpiryMs(token);
        return token;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  };
}
