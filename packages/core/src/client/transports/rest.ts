import { RestRequestError, RestTimeoutError } from "../../errors/request.js";
import type { Stamper } from "../../stampers/types.js";

export type RestRequestArgs = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
  stamp?: boolean; // When true, will stamp the request body
};

export type RestRequestFn = <T = any>(args: RestRequestArgs) => Promise<T>;

export type RestTransport = {
  config: { key: string; name: string; url: string; timeoutMs: number };
  request: RestRequestFn;
  value: Record<string, unknown>;
};

export type RestTransportConfig = {
  fetchOptions?: Omit<RequestInit, "body" | "method" | "signal">;
  onRequest?: (
    url: string,
    init: RequestInit
  ) => Promise<RequestInit | void> | RequestInit | void;
  onResponse?: (res: Response) => Promise<void> | void;
  timeoutMs?: number;
  key?: string;
  name?: string;
  stamper?: Stamper;
};

export function rest(
  url: string,
  cfg: RestTransportConfig = {}
): RestTransport {
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const key = cfg.key ?? "rest";
  const name = cfg.name ?? "HTTP REST";

  const request: RestRequestFn = async (args) => {
    const fullUrl = `${url}/${args.path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let requestBody = args.body;
      let requestHeaders = {
        "content-type": "application/json",
        ...(args.headers ?? {}),
        ...(cfg.fetchOptions?.headers ?? {}),
      };

      // Handle stamping if requested
      if (args.stamp && cfg.stamper) {
        const { body, apiUrl } = args.body;
        const bodyString = JSON.stringify(body ?? args.body);
        console.log({bodyString})
        const stamp = await cfg.stamper.stamp(bodyString);

        // Restructure request body to match backend expectation
        if (body) {
          requestBody = {
            body: bodyString,
            stamp: {
              stampHeaderName: stamp.stampHeaderName,
              stampHeaderValue: stamp.stampHeaderValue,
            },
            apiUrl: apiUrl,
          };
        } else {
          requestBody = {
            ...args.body,
            stamp: {
              stampHeaderName: stamp.stampHeaderName,
              stampHeaderValue: stamp.stampHeaderValue,
            },
          };
        }
      }
      console.log({requestBody})

      const init: RequestInit = {
        ...cfg.fetchOptions,
        method: args.method ?? "POST",
        headers: requestHeaders,
        body: requestBody != null ? JSON.stringify(requestBody) : null,
        signal: controller.signal,
      };

      const finalInit = (await cfg.onRequest?.(fullUrl, init)) ?? init;
      const res = await fetch(fullUrl, finalInit);

      await cfg.onResponse?.(res);

      let data: any;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.startsWith("application/json")) data = await res.json();
      else {
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new RestRequestError(fullUrl, res.status, data);
      return data as any;
    } catch (err: any) {
      if (err.name === "AbortError") throw new RestTimeoutError(fullUrl);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    config: { key, name, url, timeoutMs },
    request,
    value: {},
  };
}
