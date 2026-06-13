import type { AprimoConfig } from "../config.js";

export class AprimoClient {
  private readonly damBaseUrl: string;

  constructor(
    private readonly config: AprimoConfig,
    private readonly getToken: () => Promise<string>,
  ) {
    this.damBaseUrl = `https://${config.environment}.dam.aprimo.com`;
  }

  async get<T>(
    path: string,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.damBaseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "API-VERSION": "1",
        Accept: "application/hal+json",
        ...extraHeaders,
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Aprimo API error (${response.status}): ${detail}`);
    }

    return (await response.json()) as T;
  }

  async post<T>(
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.damBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "API-VERSION": "1",
        Accept: "application/hal+json",
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Aprimo API error (${response.status}): ${detail}`);
    }

    return (await response.json()) as T;
  }
}
