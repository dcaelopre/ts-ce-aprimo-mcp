export class AprimoClient {
    config;
    getToken;
    damBaseUrl;
    constructor(config, getToken) {
        this.config = config;
        this.getToken = getToken;
        this.damBaseUrl = `https://${config.environment}.dam.aprimo.com`;
    }
    async get(path, extraHeaders) {
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
        return (await response.json());
    }
    async post(path, body, extraHeaders) {
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
        return (await response.json());
    }
}
