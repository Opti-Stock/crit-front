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
  requestWithMeta<TResponse, TMeta = PaginationMeta>(
    path: string,
    options?: ApiRequestOptions,
  ): Promise<ApiSuccessResponse<TResponse, TMeta>>;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
}

export interface ApiSuccessResponse<TData, TMeta = never> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
