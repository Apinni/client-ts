import {
    EndpointData,
    JsonSchema,
    TypesSchema,
} from '../core/pipeline/modules/generator-module/types';

export type ApiSchema = {
    endpoints: EndpointData[];
    schema: TypesSchema;
};

export type { JsonSchema };

export { TypesSchema };
