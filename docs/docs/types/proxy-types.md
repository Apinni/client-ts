# Proxy Types

Apinni’s proxy types (`IApi` and `BuildApi`) structure API definitions for type generation.

## Types
- `IApi`: Defines the API structure as a record of paths and methods.
- `BuildApi<T>`: Converts an API structure into a typed interface.

## Example
```typescript
import { ApinniController, ApinniEndpoint } from '@apinni/client-ts';

@ApinniController({ path: '/api' })
class UserController {
  @ApinniEndpoint({ path: '/users', method: 'GET', responseType: '{ id: number; name: string }[]' })
  getUsers() {
    return [{ id: 1, name: 'Alice' }];
  }
}
```

Generated `IApi` and `BuildApi` usage:
```typescript
type IApi = {
  '/api/users': {
    GET: {
      response: { id: number; name: string }[];
    };
  };
};
export type Api = BuildApi<IApi>;
```

## Generated Code
From `core/type-generator/types-builder/constants.ts`:
```typescript
type IApi = Record<string, Partial<Record<ApiMethod, { request?: unknown; response?: unknown; query?: unknown }>>>;
export type BuildApi<T extends IApi> = T;
```