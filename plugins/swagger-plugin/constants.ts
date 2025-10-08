export const CONTROLLER_DECORATORS = [
    'ApiPath',
] as const satisfies Array<string>;
export const ENDPOINT_DECORATORS = [
    'ApiOperationGet',
    'ApiOperationPost',
    'ApiOperationPut',
    'ApiOperationPatch',
    'ApiOperationDelete',
] as const satisfies Array<string>;
