import { Node, Type } from 'ts-morph';

export type JsonSchemaType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'object'
    | 'array'
    | 'enum'
    | 'ref'
    | 'never'
    | 'complex'
    | 'any'
    | 'undefined';

export interface SchemaDefinitionProperties {
    global?: string;
    description?: string;
    example?: string;
    default?: string;
    deprecated?: string;
}

interface BaseJsonSchema extends SchemaDefinitionProperties {
    type: JsonSchemaType;
}

export interface StringSchema extends BaseJsonSchema {
    type: 'string';
    const?: string;
}

export interface NumberSchema extends BaseJsonSchema {
    type: 'number';
    const?: number;
}

export interface BooleanSchema extends BaseJsonSchema {
    type: 'boolean';
    const?: boolean;
}

export interface NullSchema extends BaseJsonSchema {
    type: 'null';
}

export interface EnumSchema extends BaseJsonSchema {
    type: 'enum';
    values: (string | number | boolean)[];
}

export interface ArrayItemMeta {
    optional?: boolean;
    rest?: boolean;
    name?: string;
}

export interface ArraySchema extends BaseJsonSchema {
    type: 'array';
    items: JsonSchema | (JsonSchema & ArrayItemMeta)[];
}

export interface ObjectSchema extends BaseJsonSchema {
    type: 'object';
    properties: Record<string, JsonSchema>;
    required?: string[];
    indexedProperties?: JsonSchema;
}

export interface RefSchema extends BaseJsonSchema {
    type: 'ref';
    name: string;
}

export interface AnyOfSchema extends BaseJsonSchema {
    type: 'complex';
    anyOf: JsonSchema[];
}

export interface AllOfSchema extends BaseJsonSchema {
    type: 'complex';
    allOf: JsonSchema[];
}

export interface NeverSchema extends BaseJsonSchema {
    type: 'never';
}

export interface AnySchema extends BaseJsonSchema {
    type: 'any';
}

export interface UndefinedSchema extends BaseJsonSchema {
    type: 'undefined';
}

export type JsonSchema =
    | StringSchema
    | NumberSchema
    | BooleanSchema
    | NullSchema
    | EnumSchema
    | ArraySchema
    | ObjectSchema
    | RefSchema
    | AnyOfSchema
    | AllOfSchema
    | NeverSchema
    | AnySchema
    | UndefinedSchema;

export type SchemaBuilderEntry =
    | { name: string }
    | { name: string; model: string }
    | { name: string; inline: string }
    | { name: string; type: Type; node?: Node };

export type TypesSchema = {
    schema: Record<string, JsonSchema>;
    refs: Record<string, JsonSchema>;
    mappedReferences: Record<string, string>;
};

export type DomainTypesSchema = Omit<TypesSchema, 'mappedReferences'>;

export type NamedTsTypeEntry = Extract<SchemaBuilderEntry, { type: Type }>;
export type NamedInlineTypeEntry = Extract<
    SchemaBuilderEntry,
    { inline: string }
>;
export type NamedModelTypeEntry = Extract<
    SchemaBuilderEntry,
    { model: string }
>;

export type EndpointData = {
    path: string;
    method: string;
    domains: string[];
    disabledDomains: string[];
    query?: string;
    request?: string;
    responses?: Record<number, string>;
};
