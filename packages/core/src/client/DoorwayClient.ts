import { TurnkeyClient } from "@turnkey/http";

type TurnkeyClientConfig = ConstructorParameters<typeof TurnkeyClient>[0];

interface DoorwayClientConfig extends TurnkeyClientConfig {
  proxyBaseUrl: string;
}

export class DoorwayClient extends TurnkeyClient {
  private proxyBaseUrl: string;

  constructor(
    config: DoorwayClientConfig,
    stamper: ConstructorParameters<typeof TurnkeyClient>[1]
  ) {
    super(config, stamper);
    this.proxyBaseUrl = config.proxyBaseUrl;
  }

  async requestProxy(path: string, body: any, apiKey?: string) {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(`${this.proxyBaseUrl}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }
}
