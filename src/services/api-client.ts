import type {
  ApiClient,
  ApiErrorResponse,
  ApiErrorPayload,
  ApiRequestBody,
  ApiRequestOptions,
  ApiSuccessResponse,
} from "../types/api";

interface CreateApiClientOptions {
  baseUrl: string;
  defaultHeaders?: HeadersInit;
  getAccessToken?: () => string | null;
}

export class ApiClientError extends Error {
  readonly payload?: ApiErrorPayload;
  readonly status: number;
  readonly statusText: string;

  constructor(response: Response, payload?: ApiErrorPayload) {
    super(payload?.message ?? `API request failed with status ${response.status}`);
    this.name = "ApiClientError";
    this.payload = payload;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    baseUrl,
    async request<TResponse>(
      path: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<TResponse> {
      const envelope = await requestEnvelope<TResponse>(path, requestOptions);
      return envelope.data;
    },
    async requestWithMeta<TResponse, TMeta>(
      path: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<ApiSuccessResponse<TResponse, TMeta>> {
      return requestEnvelope<TResponse, TMeta>(path, requestOptions);
    },
  };

  async function requestEnvelope<TResponse, TMeta = never>(
    path: string,
    requestOptions: ApiRequestOptions,
  ): Promise<ApiSuccessResponse<TResponse, TMeta>> {
      const url = buildUrl(baseUrl, path, requestOptions.query);
      const headers = buildHeaders(
        options.defaultHeaders,
        requestOptions.headers,
        requestOptions.body,
      );
      const accessToken = options.getAccessToken?.();

      if (accessToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      const response = await fetch(url, {
        ...requestOptions,
        body: serializeBody(requestOptions.body),
        headers,
        method: requestOptions.method ?? "GET",
      });

      if (!response.ok) {
        throw new ApiClientError(response, await parseErrorPayload(response));
      }

      return parseResponseEnvelope<TResponse, TMeta>(response);
    }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: ApiRequestOptions["query"],
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function buildHeaders(
  defaultHeaders: HeadersInit | undefined,
  requestHeaders: HeadersInit | undefined,
  body: ApiRequestBody,
): Headers {
  const headers = new Headers(defaultHeaders);
  const incomingHeaders = new Headers(requestHeaders);

  incomingHeaders.forEach((value, key) => headers.set(key, value));

  if (isJsonBody(body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function serializeBody(body: ApiRequestBody): BodyInit | null | undefined {
  if (body === null || body === undefined) {
    return body;
  }

  if (isJsonBody(body)) {
    return JSON.stringify(body);
  }

  return body;
}

function isJsonBody(body: ApiRequestBody): body is Record<string, unknown> | unknown[] {
  return (
    typeof body === "object" &&
    body !== null &&
    !(body instanceof Blob) &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof ArrayBuffer)
  );
}

async function parseResponseEnvelope<TResponse, TMeta>(
  response: Response,
): Promise<ApiSuccessResponse<TResponse, TMeta>> {
  if (response.status === 204) {
    return { success: true, data: undefined as TResponse };
  }

  const contentType = response.headers.get("Content-Type");

  if (contentType?.includes("application/json")) {
    const parsed = (await response.json()) as
      | ApiSuccessResponse<TResponse, TMeta>
      | TResponse;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "success" in parsed &&
      "data" in parsed
    ) {
      return parsed as ApiSuccessResponse<TResponse, TMeta>;
    }

    return { success: true, data: parsed as TResponse };
  }

  return { success: true, data: (await response.text()) as TResponse };
}

async function parseErrorPayload(
  response: Response,
): Promise<ApiErrorPayload | undefined> {
  const contentType = response.headers.get("Content-Type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  try {
    const parsed = (await response.json()) as
      | ApiErrorPayload
      | ApiErrorResponse;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "success" in parsed &&
      parsed.success === false
    ) {
      return (parsed as ApiErrorResponse).error;
    }

    return parsed as ApiErrorPayload;
  } catch {
    return undefined;
  }
}
