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

/**
 * Cookie-session HTTP client for Hosanna API (Better Auth).
 * Credentials are always included; there is no JWT refresh flow.
 */
export class ApiClient {
  private baseURL: string;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor(url: string) {
    this.baseURL = url;
    // Clear any legacy JWT tokens from older Studio builds.
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("hosanna_access_token");
      localStorage.removeItem("hosanna_refresh_token");
    }
  }

  public setBaseURL(url: string) {
    this.baseURL = url.endsWith("/") ? url.slice(0, -1) : url;
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
      let errorMessage = `Server error (${response.status})`;
      let errorCode: string | undefined;
      let errorDetails: unknown;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          if (typeof errorData.error === "object") {
            errorMessage = errorData.error.message || errorMessage;
            errorCode = errorData.error.code;
            errorDetails = errorData.error.details;
          } else {
            errorMessage = errorData.error;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Fallback to generic message
      }
      throw new ApiError(
        errorMessage,
        response.status,
        errorCode,
        errorDetails,
      );
    }

    return response;
  }
}
