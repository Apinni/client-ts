export class DefinitionsResolverModule {
    generate(data: {
        schema: Record<string, any>;
        refs: Record<string, any>;
    }): string {
        const parts: string[] = [];

        // Handle references
        for (const [refName, refSchema] of Object.entries(data.refs)) {
            const refBody = this.schemaToTypeInternal(refSchema, 0);
            parts.push(`export type ${refName} = ${refBody};`);
        }

        // Handle main schema entries
        for (const [schemaName, schemaDef] of Object.entries(data.schema)) {
            const body = this.schemaToTypeInternal(schemaDef, 0);
            parts.push(`export type ${schemaName} = ${body};`);
        }

        return parts.join('\n');
    }

    private schemaToTypeInternal(schema: any, indentLevel: number): string {
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

        if (schema.anyOf) {
            return this.handleUnionSchema(schema, indentLevel);
        }

        if (schema.allOf) {
            return this.handleIntersectionSchema(schema, indentLevel);
        }

        if (schema.not) {
            return 'never';
        }

        return 'any';
    }

    private getIndent(level: number): string {
        return '  '.repeat(level);
    }

    private handleArraySchema(schema: any, indentLevel: number): string {
        if (Array.isArray(schema.items)) {
            const itemsTypes = schema.items
                .map((item: any) =>
                    this.schemaToTypeInternal(item, indentLevel)
                )
                .join(', ');
            return `[${itemsTypes}]`;
        }
        const itemsType = this.schemaToTypeInternal(schema.items, indentLevel);
        const needsParens =
            itemsType.includes(' & ') || itemsType.includes(' | ');
        return needsParens ? `(${itemsType})[]` : `${itemsType}[]`;
    }

    private handleObjectSchema(schema: any, indentLevel: number): string {
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
            const propNameFormatted = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
                propName
            )
                ? propName
                : `"${propName}"`;
            propLines.push(
                `${this.getIndent(indentLevel + 1)}${propNameFormatted}${isOptional ? '?' : ''}: ${propType};`
            );
        }

        const propsStr = propLines.join('\n');
        return `{\n${propsStr}\n${this.getIndent(indentLevel)}}`;
    }

    private handleEnumSchema(schema: any): string {
        return schema.values
            .map((value: any) =>
                typeof value === 'string' ? `"${value}"` : value
            )
            .join(' | ');
    }

    private handleUnionSchema(schema: any, indentLevel: number): string {
        const unionTypes = schema.anyOf.map((subSchema: any) => {
            const subType = this.schemaToTypeInternal(subSchema, indentLevel);
            const needsParens =
                !!subSchema.anyOf || subSchema.type === 'generic';
            return needsParens ? `(${subType})` : subType;
        });
        return unionTypes.join(' | ');
    }

    private handleIntersectionSchema(schema: any, indentLevel: number): string {
        const intersectionTypes = schema.allOf.map((subSchema: any) => {
            const subType = this.schemaToTypeInternal(subSchema, indentLevel);
            // Only add parentheses for union or generic types, not objects
            const needsParens = !!subSchema.anyOf;
            return needsParens ? `(${subType})` : subType;
        });
        const indent = this.getIndent(indentLevel);
        return intersectionTypes.join(` &\n${indent}`);
    }
}
