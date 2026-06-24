export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiRequestBody =
  | BodyInit
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

export interface ApiRequestOptions
  extends Omit<RequestInit, "body" | "headers" | "method"> {
  body?: ApiRequestBody;
  headers?: HeadersInit;
  method?: ApiHttpMethod;
  query?: Record<string, ApiQueryValue>;
}

export interface ApiClient {
  readonly baseUrl: string;
  request<TResponse>(
    path: string,
    options?: ApiRequestOptions,
  ): Promise<TResponse>;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}
