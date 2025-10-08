export const PROXY_TYPES = `type IApi = Record<
  string,
  Partial<
    Record<
      ApiMethod,
      {
        request?: unknown;
        responses?: Record<number, unknown>;
        query?: unknown;
      }
    >
  >
>;

export type BuildApi<T extends IApi> = T;`;

export const DEFAULT_UTILITY_TYPES = `type _ApiPaths<TApi extends IApi> = Extract<keyof TApi, string>;

type _ApiAvailableMethods<
  TApi extends IApi,
  T extends _ApiPaths<TApi>
> = keyof TApi[T] & ApiMethod;

type _ApiResponses<
  TApi extends IApi,
  T extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, T> = _ApiAvailableMethods<TApi, T>
> = TApi[T][M] extends { responses: infer R } ? R : never;

type ExtractStatusCodeStrings<
  TApi extends IApi,
  T extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, T>
> = _ApiResponses<TApi, T, M> extends infer Responses
  ? Responses extends Record<number, any>
    ? \`\${keyof Responses & number}\`
    : never
  : never;

type _ApiResponsesByStatus<
  TApi extends IApi,
  T extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, T> = _ApiAvailableMethods<TApi, T>,
  S extends ExtractStatusCodeStrings<TApi, T, M> = ExtractStatusCodeStrings<
    TApi,
    T,
    M
  >
> = _ApiResponses<TApi, T, M> extends infer Responses
  ? Responses extends Record<number, any>
    ? S extends \`\${infer Index extends keyof Responses & number}\`
      ? Responses[Index]
      : Responses[keyof Responses]
    : never
  : never;

// Extract request type
type _ApiRequest<
  TApi extends IApi,
  T extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, T> = _ApiAvailableMethods<TApi, T>
> = TApi[T][M] extends { request: infer R } ? R : never;

// Extract query type
type _ApiQuery<
  TApi extends IApi,
  T extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, T> = _ApiAvailableMethods<TApi, T>
> = TApi[T][M] extends { query: infer Q } ? Q : never;

type MakePathSegments<T extends string> =
  T extends \`\${infer Start}/:\${infer Param}\`
    ? Param extends \`\${infer _}/\${infer Rest}\`
      ? [\`\${Start}/\`, string, ...MakePathSegments<\`/\${Rest}\`>]
      : [\`\${Start}/\`, string]
    : [T];

type ExtractParams<T extends string> = T extends \`\${infer _}/:\${infer Param}\`
  ? Param extends \`\${infer Name}/\${infer Rest}\`
    ? {
        [key in Name | keyof ExtractParams<\`/\${Rest}\`>]: string;
      }
    : {
        [key in Param]: string;
      }
  : unknown;

type TypedJoin<T extends Array<string>> = T extends [
  infer First,
  ...infer Rest extends Array<string>
]
  ? \`\${First & string}\${TypedJoin<Rest>}\`
  : "";

type ResolveArgs<
  TApi extends IApi,
  P extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, P> = _ApiAvailableMethods<TApi, P>
> = keyof ExtractParams<P> extends never
  ? _ApiQuery<TApi, P, M> extends never
    ? []
    : [{ query: _ApiQuery<TApi, P, M> }]
  : _ApiQuery<TApi, P, M> extends never
  ? [{ params: ExtractParams<P> }]
  : [{ params: ExtractParams<P>; query: _ApiQuery<TApi, P, M> }];

type _ApiPathBuilder<
  TApi extends IApi,
  P extends _ApiPaths<TApi>,
  M extends _ApiAvailableMethods<TApi, P> = _ApiAvailableMethods<TApi, P>
> = ResolveArgs<TApi, P, M> extends []
  ? () => \`\${TypedJoin<MakePathSegments<P>>}\`
  : (
      args: ResolveArgs<TApi, P, M>[0]
    ) => \`\${TypedJoin<MakePathSegments<P>>}\${_ApiQuery<
      TApi,
      P,
      M
    > extends never
      ? ""
      : "" | \`?\${string}\`}\`;

// Public API path keys (e.g., "/users/:id")
export type ApiPaths = _ApiPaths<Api>;
export type ApiPathsProxy<T extends IApi> = _ApiPaths<T>;

// Get methods available on a path
export type ApiAvailableMethods<T extends ApiPaths> = _ApiAvailableMethods<
  Api,
  T
>;
export type ApiAvailableMethodsProxy<
  A extends IApi,
  T extends ApiPathsProxy<A>
> = _ApiAvailableMethods<A, T>;

// Extract responses type
export type ApiResponses<
  T extends ApiPaths,
  M extends ApiAvailableMethods<T> = ApiAvailableMethods<T>
> = _ApiResponses<Api, T, M>;
export type ApiResponsesProxy<
  A extends IApi,
  T extends ApiPathsProxy<A>,
  M extends ApiAvailableMethodsProxy<A, T> = ApiAvailableMethodsProxy<A, T>
> = _ApiResponses<A, T, M>;

// Extract response type by status
export type ApiResponsesByStatus<
  T extends ApiPaths,
  M extends ApiAvailableMethods<T> = ApiAvailableMethods<T>,
  S extends ExtractStatusCodeStrings<Api, T, M> = ExtractStatusCodeStrings<
    Api,
    T,
    M
  >
> = _ApiResponsesByStatus<Api, T, M, S>;
export type ApiResponsesByStatusProxy<
  A extends IApi,
  T extends ApiPathsProxy<A>,
  M extends ApiAvailableMethodsProxy<A, T> = ApiAvailableMethodsProxy<A, T>,
  S extends ExtractStatusCodeStrings<A, T, M> = ExtractStatusCodeStrings<
    A,
    T,
    M
  >
> = _ApiResponsesByStatus<A, T, M, S>;

// Extract request type
export type ApiRequest<
  T extends ApiPaths,
  M extends ApiAvailableMethods<T> = ApiAvailableMethods<T>
> = _ApiRequest<Api, T, M>;
export type ApiRequestProxy<
  A extends IApi,
  T extends ApiPathsProxy<A>,
  M extends ApiAvailableMethodsProxy<A, T> = ApiAvailableMethodsProxy<A, T>
> = _ApiRequest<A, T, M>;

// Extract query type
export type ApiQuery<
  T extends ApiPaths,
  M extends ApiAvailableMethods<T> = ApiAvailableMethods<T>
> = _ApiQuery<Api, T, M>;
export type ApiQueryProxy<
  A extends IApi,
  T extends ApiPathsProxy<A>,
  M extends ApiAvailableMethodsProxy<A, T> = ApiAvailableMethodsProxy<A, T>
> = _ApiQuery<A, T, M>;

export type ApiPathBuilder<
  P extends ApiPaths,
  M extends ApiAvailableMethods<P> = ApiAvailableMethods<P>
> = _ApiPathBuilder<Api, P, M>;
export type ApiPathBuilderProxy<
  A extends IApi,
  P extends ApiPathsProxy<A>,
  M extends ApiAvailableMethodsProxy<A, P> = ApiAvailableMethodsProxy<A, P>
> = _ApiPathBuilder<A, P, M>;
`;
