# Utility Types

Apinni generates utility types to facilitate typed API interactions.

## Types
- `ApiPaths`: Extracts API path keys (e.g., `/api/users/:id`).
- `ApiAvailableMethods<T>`: Gets available HTTP methods for a path.
- `ApiResponse<T, M>`: Extracts the response type for a path and method.
- `ApiRequest<T, M>`: Extracts the request type.
- `ApiQuery<T, M>`: Extracts the query type.
- `ApiPathBuilder<T, M>`: Builds typed path strings, handling parameters and queries.

## Example
```typescript
import { ApiPaths, ApiResponse, ApiPathBuilder } from './types/api-types';

type Path = ApiPaths; // e.g., '/api/users/:id'
type Response = ApiResponse<'/api/users/:id', 'GET'>; // e.g., { id: number; name: string }[]
const pathBuilder: ApiPathBuilder<'/api/users/:id', 'GET'> = (args) => `/api/users/${args.params.id}`;
```

## Generated Code
From `core/type-generator/types-builder/constants.ts`:
```typescript
type _ApiPaths<TApi extends IApi> = Extract<keyof TApi, string>;
type _ApiResponse<TApi extends IApi, T extends _ApiPaths<TApi>, M extends _ApiAvailableMethods<TApi, T>> = TApi[T][M] extends { response: infer R } ? R : never;
// ... (other utility types)
export type ApiPaths = _ApiPaths<Api>;
export type ApiResponse<T extends ApiPaths, M extends ApiAvailableMethods<T>> = _ApiResponse<Api, T, M>;
```