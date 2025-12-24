import {
    AllOfSchema,
    AnyOfSchema,
    ArraySchema,
    EnumSchema,
    JsonSchema,
    ObjectSchema,
    TypesSchema,
} from '../../types';
import { SUPPORTED_JSDOCS_TAGS } from '../schema-builder-module/utils';

export class DefinitionsResolverModule {
    generate(data: Pick<TypesSchema, 'schema' | 'refs'>): string {
        const parts: string[] = [];

        // Handle references
        for (const [refName, refSchema] of Object.entries(data.refs)) {
            const refBody = this.schemaToTypeInternal(refSchema, 0);
            const jsDocs = this.schemaToJSDoc(refSchema);
            if (jsDocs) {
                parts.push(jsDocs);
            }
            parts.push(`export type ${refName} = ${refBody};`);
        }

        // Handle main schema entries
        for (const [schemaName, schemaDef] of Object.entries(data.schema)) {
            const body = this.schemaToTypeInternal(schemaDef, 0);
            const jsDocs = this.schemaToJSDoc(schemaDef);
            if (jsDocs) {
                parts.push(jsDocs);
            }
            parts.push(`export type ${schemaName} = ${body};`);
        }

        return parts.join('\n');
    }

    private schemaToJSDoc(schema: JsonSchema | undefined): string {
        if (!schema || typeof schema !== 'object') return '';

        const schemaRecord = schema as unknown as Record<string, unknown>;
        const lines: string[] = [];

        if (schemaRecord.global) {
            lines.push(` * ${String(schemaRecord.global)}`);
        }

        Object.keys(schemaRecord)
            .filter(key =>
                SUPPORTED_JSDOCS_TAGS.includes(
                    key as (typeof SUPPORTED_JSDOCS_TAGS)[number]
                )
            )
            .forEach(key => {
                lines.push(` * @${key} ${String(schemaRecord[key])}`);
            });

        return lines.length ? `/**\n${lines.join('\n')}\n */` : '';
    }

    private schemaToTypeInternal(
        schema: JsonSchema | undefined,
        indentLevel: number
    ): string {
        if (!schema || typeof schema !== 'object') return 'any';

        if (schema.type === 'ref' && schema.name) {
            return schema.name;
        }

        if (schema.type === 'string') {
            return schema.const ? `'${schema.const}'` : 'string';
        }

        if (schema.type === 'number') {
            return schema.const ? `${schema.const}` : 'number';
        }

        if (schema.type === 'boolean') {
            return schema.const ? `${schema.const}` : 'boolean';
        }

        if (schema.type === 'null') {
            return 'null';
        }

        if (Object.keys(schema).length === 0) {
            return 'any';
        }

        if (schema.type === 'array') {
            return this.handleArraySchema(schema, indentLevel);
        }

        if (schema.type === 'object') {
            return this.handleObjectSchema(schema, indentLevel);
        }

        if (schema.type === 'enum' && schema.values) {
            return this.handleEnumSchema(schema);
        }

        if ('anyOf' in schema && schema.anyOf) {
            return this.handleUnionSchema(schema, indentLevel);
        }

        if ('allOf' in schema && schema.allOf) {
            return this.handleIntersectionSchema(schema, indentLevel);
        }

        if ('not' in (schema as unknown as Record<string, unknown>)) {
            return 'never';
        }

        return 'any';
    }

    private getIndent(level: number): string {
        return '  '.repeat(level);
    }

    private handleArraySchema(
        schema: ArraySchema,
        indentLevel: number
    ): string {
        if (Array.isArray(schema.items)) {
            const itemsTypes = schema.items
                .map((item: any) => {
                    const type = this.schemaToTypeInternal(item, indentLevel);

                    if (item.optional) {
                        return item.name
                            ? `${item.name}?: ${type}`
                            : `${type}?`;
                    }

                    const prefix = item.name ? `${item.name}: ` : '';

                    if (item.rest) {
                        return `...${prefix}(${type})[]`;
                    }

                    return `${prefix}${type}`;
                })
                .join(', ');
            return `[${itemsTypes}]`;
        }
        const itemsType = this.schemaToTypeInternal(schema.items, indentLevel);
        const needsParens =
            itemsType.includes(' & ') || itemsType.includes(' | ');
        return needsParens ? `(${itemsType})[]` : `${itemsType}[]`;
    }

    private handleObjectSchema(
        schema: ObjectSchema,
        indentLevel: number
    ): string {
        const properties = schema.properties || {};
        const required = new Set(schema.required || []);
        const propLines: string[] = [];

        // Handle indexed properties (from index signatures)
        if (schema.indexedProperties) {
            const indexType = this.schemaToTypeInternal(
                schema.indexedProperties,
                indentLevel + 1
            );
            propLines.push(
                `${this.getIndent(indentLevel + 1)}[key: string]: ${indexType};`
            );
        }

        for (const [propName, propSchema] of Object.entries(properties) as [
            string,
            any,
        ][]) {
            const isOptional = !required.has(propName);
            const propType = this.schemaToTypeInternal(
                propSchema,
                indentLevel + 1
            );
            const propJSDoc = this.schemaToJSDoc(propSchema);
            const propNameFormatted = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
                propName
            )
                ? propName
                : `"${propName}"`;
            propJSDoc
                .split('\n')
                .filter(Boolean)
                .forEach(line =>
                    propLines.push(`${this.getIndent(indentLevel + 1)}${line}`)
                );
            propLines.push(
                `${this.getIndent(indentLevel + 1)}${propNameFormatted}${isOptional ? '?' : ''}: ${propType};`
            );
        }

        const propsStr = propLines.join('\n');
        return `{\n${propsStr}\n${this.getIndent(indentLevel)}}`;
    }

    private handleEnumSchema(schema: EnumSchema): string {
        return schema.values
            .map((value: any) =>
                typeof value === 'string' ? `"${value}"` : value
            )
            .join(' | ');
    }

    private handleUnionSchema(
        schema: AnyOfSchema,
        indentLevel: number
    ): string {
        const unionTypes = schema.anyOf.map(subSchema => {
            const subType = this.schemaToTypeInternal(subSchema, indentLevel);
            const needsParens =
                ('anyOf' in (subSchema as unknown as Record<string, unknown>) &&
                    Array.isArray((subSchema as Partial<AnyOfSchema>).anyOf)) ||
                subSchema.type === 'complex';
            return needsParens ? `(${subType})` : subType;
        });
        return unionTypes.join(' | ');
    }

    private handleIntersectionSchema(
        schema: AllOfSchema,
        indentLevel: number
    ): string {
        const intersectionTypes = schema.allOf.map(subSchema => {
            const subType = this.schemaToTypeInternal(subSchema, indentLevel);
            // Only add parentheses for union or generic types, not objects
            const needsParens =
                'anyOf' in (subSchema as unknown as Record<string, unknown>) &&
                Array.isArray((subSchema as Partial<AnyOfSchema>).anyOf);
            return needsParens ? `(${subType})` : subType;
        });
        const indent = this.getIndent(indentLevel);
        return intersectionTypes.join(` &\n${indent}`);
    }
}
