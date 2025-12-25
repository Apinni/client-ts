export interface IApiPathArgs {
    path: string;
    name: string;
    description?: string;
    security?: {
        [key: string]: any[];
    };
    deprecated?: boolean;
}

export interface IApiOperationArgsBaseParameter {
    name?: string;
    description?: string;
    type?: string;
    required?: boolean;
    format?: string;
    minimum?: number;
    maximum?: number;
    default?: number;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
}
export interface IApiPropertyBodyOperationArgsBaseParameter {
    type: string;
    required?: boolean;
}
export interface IApiBodyOperationArgsBaseParameter
    extends IApiOperationArgsBaseParameter {
    properties?: {
        [key: string]: IApiPropertyBodyOperationArgsBaseParameter;
    };
    model?: string;
}
export interface IApiOperationArgsBaseResponse {
    description?: string;
    type?: string;
    model?: string;
}
export interface IApiOperationArgsBaseParameters {
    header?: {
        [key: string]: IApiOperationArgsBaseParameter;
    };
    path?: {
        [key: string]: IApiOperationArgsBaseParameter;
    };
    query?: {
        [key: string]: IApiOperationArgsBaseParameter;
    };
    body?: IApiBodyOperationArgsBaseParameter;
    formData?: {
        [key: string]: IApiOperationArgsBaseParameter;
    };
}
export interface IApiOperationArgsBase {
    description?: string;
    summary?: string;
    produces?: string[];
    consumes?: string[];
    tags?: string[];
    path?: string;
    parameters?: IApiOperationArgsBaseParameters;
    responses: {
        [key: string]: IApiOperationArgsBaseResponse;
    };
    security?: {
        [key: string]: any[];
    };
    deprecated?: boolean;
}
