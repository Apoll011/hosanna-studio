import createClient, { type Client, type Middleware } from "openapi-fetch";
import type { paths } from "./generated/schema";

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type OpenapiClient = Client<paths>;

function normalizeBaseURL(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function apiErrorFromBody(errorData: unknown, status: number): ApiError {
  let errorMessage = `Server error (${status})`;
  let errorCode: string | undefined;
  let errorDetails: unknown;

  if (errorData && typeof errorData === "object") {
    const body = errorData as Record<string, unknown>;
    if (body.error) {
      if (typeof body.error === "object" && body.error !== null) {
        const err = body.error as Record<string, unknown>;
        errorMessage =
          typeof err.message === "string" ? err.message : errorMessage;
        errorCode = typeof err.code === "string" ? err.code : undefined;
        errorDetails = err.details;
      } else if (typeof body.error === "string") {
        errorMessage = body.error;
      }
    } else if (typeof body.message === "string") {
      errorMessage = body.message;
    }
  }

  return new ApiError(errorMessage, status, errorCode, errorDetails);
}

/**
 * Unwrap an openapi-fetch result, throwing {@link ApiError} on failure.
 * Preserves 204 → empty object behavior from the previous ApiClient.
 */
export async function unwrapApiResult<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  const { data, error, response } = result;

  if (!response.ok) {
    throw apiErrorFromBody(error ?? data, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return data as T;
}

/**
 * Cookie-session HTTP client for Hosanna API (Better Auth).
 * Typed calls go through openapi-fetch; {@link request}/{@link request_raw}
 * remain for paths outside the OpenAPI surface (auth consent, legacy sync, etc.).
 */
export class ApiClient {
  private baseURL: string;
  private onUnauthorizedCallback: (() => void) | null = null;
  private _openapi: OpenapiClient;

  constructor(url: string) {
    this.baseURL = normalizeBaseURL(url);
    this._openapi = this.createOpenapiClient();
    // Clear any legacy JWT tokens from older Studio builds.
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("hosanna_access_token");
      localStorage.removeItem("hosanna_refresh_token");
    }
  }

  private createOpenapiClient(): OpenapiClient {
    const client = createClient<paths>({
      baseUrl: this.baseURL,
      credentials: "include",
    });

    const self = this;
    const unauthorizedMiddleware: Middleware = {
      async onResponse({ response, request }) {
        if (
          response.status === 401 &&
          self.onUnauthorizedCallback &&
          !request.url.includes("/auth/")
        ) {
          self.onUnauthorizedCallback();
        }
      },
    };
    client.use(unauthorizedMiddleware);
    return client;
  }

  /** Typed openapi-fetch client (paths from generated schema). */
  get openapi(): OpenapiClient {
    return this._openapi;
  }

  public setBaseURL(url: string) {
    this.baseURL = normalizeBaseURL(url);
    this._openapi = this.createOpenapiClient();
  }

  public getBaseURL(): string {
    return this.baseURL;
  }

  public onUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const req = await this.request_raw(endpoint, options);

    if (req.status === 204) {
      return {} as T;
    }

    return req.json();
  }

  public async request_raw(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = endpoint.startsWith("/")
      ? `${this.baseURL}${endpoint}`
      : `${this.baseURL}/${endpoint}`;

    const requestHeaders: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => {
          requestHeaders[k] = v;
        });
      } else if (typeof options.headers === "object") {
        Object.entries(options.headers).forEach(([k, v]) => {
          if (v !== undefined) requestHeaders[k] = String(v);
        });
      }
    }
    if (
      !requestHeaders["Content-Type"] &&
      !(options.body instanceof FormData)
    ) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const config: RequestInit = {
      credentials: "include",
      ...options,
      headers: requestHeaders,
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to server";
      throw new ApiError(`Network Error: ${message}`, 0);
    }

    if (response.status === 401) {
      if (this.onUnauthorizedCallback && !endpoint.includes("auth/")) {
        this.onUnauthorizedCallback();
      }
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = undefined;
      }
      throw apiErrorFromBody(errorData, response.status);
    }

    return response;
  }
}
