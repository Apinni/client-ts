import {
    Node,
    Project,
    SourceFile,
    Symbol,
    SyntaxKind,
    ts,
    Type,
    TypeChecker,
} from 'ts-morph';

const isBuiltInTypeSymbol = (symbol?: Symbol) => {
    const declarations = symbol?.getDeclarations() || [];
    if (!declarations.length) return false;

    return declarations.every(decl => {
        const sourceFile = decl.getSourceFile();
        const filePath = sourceFile.getFilePath();

        // Built-ins are typically from the lib*.d.ts files (e.g. lib.es5.d.ts)
        return filePath.includes('node_modules/typescript/lib/lib');
    });
};

function resolvePropertyTypeByChecker(
    checker: TypeChecker,
    prop: Symbol,
    node?: Node
) {
    if (!node) {
        return null;
    }

    return checker.getTypeOfSymbolAtLocation(prop, node);
}

export function getTypeAndNode(
    sourceFile: SourceFile | null,
    inputType: string,
    nameIfCustomType?: string
) {
    if (!sourceFile) {
        return null;
    }
    const typeAlias = sourceFile.getTypeAlias(inputType);
    if (typeAlias) {
        return { type: typeAlias.getType(), node: typeAlias.getTypeNode() };
    }

    const iface = sourceFile.getInterface(inputType);
    if (iface) {
        return { type: iface.getType(), node: iface };
    }

    const cls = sourceFile.getClass(inputType);
    if (cls) {
        return { type: cls.getType(), node: cls };
    }

    const variable = sourceFile.getVariableDeclaration(inputType);
    if (variable && variable.getTypeNode()) {
        return { type: variable.getType(), node: variable };
    }

    const tempAliasName = `Internal_${nameIfCustomType || Date.now()}`;

    const createdAlias = sourceFile.addTypeAlias({
        name: tempAliasName,
        type: inputType,
    });

    if (createdAlias) {
        return {
            type: createdAlias.getType(),
            node: createdAlias.getTypeNode(),
        };
    }

    return null;
}

type JsonSchemaType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'object'
    | 'array'
    | 'enum'
    | 'ref';

interface BaseJsonSchema {
    type?: JsonSchemaType;
}

interface StringSchema extends BaseJsonSchema {
    type: 'string';
    const?: string;
}

interface NumberSchema extends BaseJsonSchema {
    type: 'number';
    const?: number;
}

interface BooleanSchema extends BaseJsonSchema {
    type: 'boolean';
    const?: boolean;
}

interface NullSchema extends BaseJsonSchema {
    type: 'null';
}

interface EnumSchema extends BaseJsonSchema {
    type: 'enum';
    values: (string | number | boolean)[];
}

interface ArraySchema extends BaseJsonSchema {
    type: 'array';
    items: JsonSchema | JsonSchema[];
}

interface ObjectSchema extends BaseJsonSchema {
    type: 'object';
    properties: Record<string, JsonSchema>;
    required?: string[];
    indexedProperties?: JsonSchema;
}

interface RefSchema extends BaseJsonSchema {
    type: 'ref';
    name: string;
}

interface AnyOfSchema extends BaseJsonSchema {
    anyOf: JsonSchema[];
}

interface AllOfSchema extends BaseJsonSchema {
    allOf: JsonSchema[];
}

interface NotSchema extends BaseJsonSchema {
    not: JsonSchema;
}

type JsonSchema =
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
    | NotSchema
    | object;

type Entry =
    | { name: string; model: string }
    | { name: string; type: Type; node?: Node }
    | { name: string; inline: string };

export type TypesSchema = {
    schema: Record<string, JsonSchema>;
    refs: Record<string, JsonSchema>;
    mappedReferences: Record<string, string>;
};

export class SchemaBuilderModule {
    private checker: TypeChecker;
    private project: Project;
    public referencesMaps = new Map<string, Map<string, JsonSchema>>();

    private collectedTypes: string = '';

    constructor(project: Project) {
        this.project = project;

        this.checker = this.project.getTypeChecker();
    }

    public storeCollectedTypes(types: string) {
        this.collectedTypes = types;
    }

    private handlers = [
        {
            condition: type => type.isAny() || type.isUnknown(),
            resolver: (): JsonSchema => ({}),
        },
        {
            condition: type => type.isNever(),
            resolver: (): NotSchema => ({ not: {} }),
        },
        {
            condition: type => type.isNull(),
            resolver: (): NullSchema => ({ type: 'null' }),
        },
        {
            condition: type => type.isString() || type.isTemplateLiteral(),
            resolver: (): StringSchema => ({ type: 'string' }),
        },
        {
            condition: type => type.isNumber(),
            resolver: (): NumberSchema => ({ type: 'number' }),
        },
        {
            condition: type => type.isBoolean(),
            resolver: (): BooleanSchema => ({ type: 'boolean' }),
        },
        {
            condition: type => type.isStringLiteral(),
            resolver: ({ type }): StringSchema => ({
                type: 'string',
                const: type.getLiteralValue() as string,
            }),
        },
        {
            condition: type => type.isNumberLiteral(),
            resolver: ({ type }): NumberSchema => ({
                type: 'number',
                const: type.getLiteralValue() as number,
            }),
        },
        {
            condition: type => type.isBooleanLiteral(),
            resolver: ({ type }): BooleanSchema => ({
                type: 'boolean',
                const: type.getText() === 'true',
            }),
        },
        {
            condition: type => type.isEnum(),
            resolver: ({ type }): EnumSchema => {
                const values = type
                    .getUnionTypes()
                    .map(t => t.getLiteralValue())
                    .filter((v): v is string | number => v !== undefined);

                return { type: 'enum', values };
            },
        },
        {
            condition: type => type.getText() === 'Date',
            resolver: (): StringSchema => ({ type: 'string' }),
        },
        {
            condition: type => type.getSymbol()?.getName() === 'Promise',
            resolver: ({ type, ...rest }): JsonSchema => {
                const wrappedType = type.getTypeArguments()[0];
                return this.convert({ type: wrappedType, ...rest });
            },
        },
        {
            condition: type => type.isArray(),
            resolver: this.handleArray.bind(this),
        },
        {
            condition: type => type.isTuple(),
            resolver: this.handleTuple.bind(this),
        },
        {
            condition: type => type.isUnion(),
            resolver: this.handleUnion.bind(this),
        },
        {
            condition: type => type.isIntersection(),
            resolver: this.handleIntersection.bind(this),
        },
        {
            condition: type => type.isObject(),
            resolver: this.handleObject.bind(this),
        },
    ] as Array<{
        condition: (type: Type) => boolean;
        resolver: (params: {
            type: Type;
            node?: Node;
            name?: string;
        }) => JsonSchema;
    }>;

    public generateSchema(entries: Array<Entry>): TypesSchema {
        this.referencesMaps = new Map();
        const schema: Record<string, JsonSchema> = {};

        const entriesWithTypeAndNodes = entries.filter(
            entry => 'type' in entry
        );

        const entriesWithModels = entries.filter(entry => 'model' in entry);

        const entriesWithInlineTypes = entries.filter(
            entry => 'inline' in entry
        );

        for (const entry of entriesWithTypeAndNodes) {
            if (!entry.name) continue;

            // If type is actually inline it - it will equal target type
            if (
                entry.type.getAliasSymbol() ===
                    entry.type.getTargetType()?.getAliasSymbol() &&
                entry.node
            ) {
                const alias = entry.node.getSourceFile().addTypeAlias({
                    name: `__temp__${Date.now()}`,
                    type: entry.type.getText(),
                });

                schema[entry.name] = this.convert({
                    type: alias?.getType(),
                    node: alias,
                    name: entry.name,
                });
                alias.remove();
            } else {
                schema[entry.name] = this.convert(entry);
            }
        }

        const realProject = this.project;

        const temporalProject = new Project({
            useInMemoryFileSystem: true,
            compilerOptions: {
                lib: ['lib.es2024.d.ts'],
                strictNullChecks: true,
            },
        });

        this.project = temporalProject;
        this.checker = this.project.getTypeChecker();

        const tempFile = this.project.createSourceFile(
            `__temp__${Date.now()}.ts`,
            this.collectedTypes
        );

        for (const entry of entriesWithInlineTypes) {
            if (!entry.name) continue;

            const alias = tempFile.addTypeAlias({
                name: `__temp__${Date.now()}`,
                type: entry.inline,
            });

            schema[entry.name] = this.convert({
                type: alias?.getType(),
                node: alias,
                name: entry.name,
            });
            alias.remove();
        }

        for (const entry of entriesWithModels) {
            if (!entry.name) continue;

            const data = getTypeAndNode(tempFile, entry.model, entry.name);

            if (!data) {
                continue;
            }

            schema[entry.name] = this.convert({ ...data, name: entry.name });
        }

        this.project.removeSourceFile(tempFile);

        this.project = realProject;
        this.checker = this.project.getTypeChecker();

        const uniqueReferences: Record<string, JsonSchema> = {};

        for (const [_, map] of this.referencesMaps.entries()) {
            for (const [typeName, definition] of map.entries()) {
                if (uniqueReferences[typeName]) {
                    continue;
                }
                uniqueReferences[typeName] = definition;
            }
        }

        const mappedReferences: Record<string, string> = {};

        for (const key in schema) {
            if (uniqueReferences[key]) {
                let counter = 1;
                while (
                    uniqueReferences[`${key}_${counter}`] ||
                    schema[`${key}_${counter}`]
                ) {
                    counter += 1;
                }

                const uniqueName = `${key}_${counter}`;

                schema[uniqueName] = schema[key];
                delete schema[key];

                mappedReferences[key] = uniqueName;
            }
        }

        return {
            schema,
            refs: uniqueReferences,
            mappedReferences,
        };
    }

    public convert({
        type,
        node,
        name,
        reference,
    }: {
        type: Type;
        node?: Node;
        name?: string;
        reference?: string;
    }): JsonSchema {
        const aliasSymbol = type.getAliasSymbol();
        const targetAliasSymbol = type.getTargetType()?.getAliasSymbol();
        const symbol = type.getSymbol();

        const referenceMapName = name || '__default';

        if (!this.referencesMaps.has(referenceMapName)) {
            this.referencesMaps.set(referenceMapName, new Map());
        }

        const referenceName =
            (!targetAliasSymbol || targetAliasSymbol === aliasSymbol) &&
            (aliasSymbol?.getName() || symbol?.getName());

        if (
            referenceName &&
            !['__type', '__object'].includes(referenceName) &&
            !referenceName.includes('__temp__') &&
            !isBuiltInTypeSymbol(type.getSymbol()) &&
            referenceName !== reference
        ) {
            const args = type.getAliasTypeArguments();

            if (args.length > 0) {
                for (const arg of args) {
                    const argName = arg.getAliasSymbol()?.getName();

                    if (
                        !argName ||
                        this.referencesMaps.get(referenceMapName)?.has(argName)
                    ) {
                        continue;
                    }

                    this.referencesMaps.get(referenceMapName)?.set(
                        argName,
                        this.convert({
                            type: arg,
                            node,
                            name: referenceMapName,
                            reference: argName,
                        })
                    );
                }

                const target = type.getApparentType();

                return this.convert({
                    type: target,
                    node,
                    reference: referenceName,
                });
            }

            if (
                !this.referencesMaps.get(referenceMapName)?.has(referenceName)
            ) {
                this.referencesMaps.get(referenceMapName)?.set(
                    referenceName,
                    this.convert({
                        type,
                        node,
                        name: referenceMapName,
                        reference: referenceName,
                    })
                );
            }

            return { type: 'ref', name: referenceName };
        }

        const resolver = this.handlers.find(handler =>
            handler.condition(type)
        )?.resolver;

        if (!resolver) {
            return {};
        }

        return resolver({ type, node, name: referenceMapName });
    }

    private handleArray({
        type,
        ...rest
    }: {
        type: Type;
        node?: Node;
        name?: string;
    }): ArraySchema {
        const elementType = type.getArrayElementTypeOrThrow();

        return {
            type: 'array',
            items: this.convert({ type: elementType, ...rest }),
        };
    }

    private handleTuple({
        type,
        ...rest
    }: {
        type: Type;
        node?: Node;
        name?: string;
    }): ArraySchema {
        const tupleTypes = type.getTupleElements();

        const items = tupleTypes.map(tuple =>
            this.convert({ type: tuple, ...rest })
        );

        return { type: 'array', items };
    }

    private handleUnion({
        type,
        ...rest
    }: {
        type: Type;
        node?: Node;
        name?: string;
    }): AnyOfSchema | JsonSchema {
        const unionTypes = type
            .getUnionTypes()
            .filter(union => !union.isUndefined());

        if (unionTypes.length === 1) {
            return this.convert({ type: unionTypes[0], ...rest }) as JsonSchema;
        }

        const isMappedBoolean = unionTypes.every(union =>
            union.isBooleanLiteral()
        );
        if (isMappedBoolean) {
            return {
                type: 'boolean',
            };
        }

        const allLiterals = unionTypes.every(union => union.isLiteral());
        if (allLiterals) {
            return {
                type: 'enum',
                values: unionTypes.map(union => union.getLiteralValue()),
            };
        }

        const definitions = unionTypes.map(union =>
            this.convert({ type: union, ...rest })
        );

        return { anyOf: definitions };
    }

    private handleIntersection({
        type,
        ...rest
    }: {
        type: Type;
        node?: Node;
        name?: string;
    }): AllOfSchema {
        const intersectionTypes = type.getIntersectionTypes();

        const definitions = intersectionTypes.map(intersection =>
            this.convert({ type: intersection, ...rest })
        );

        return { allOf: definitions };
    }

    private handleObject({
        type,
        ...rest
    }: {
        type: Type<ts.ObjectType>;
        node?: Node;
        name?: string;
    }): ObjectSchema {
        const properties: { [key: string]: any } = {};
        const required: string[] = [];

        const isMappedType = Boolean(type.getTargetType());

        for (const prop of type.getApparentProperties()) {
            let propType: Type | null = null;

            if (isMappedType && rest.node) {
                propType = resolvePropertyTypeByChecker(
                    this.checker,
                    prop,
                    rest.node
                );
            } else {
                const decl = prop.getDeclarations()[0];
                if (decl) {
                    propType =
                        decl.isKind(SyntaxKind.PropertySignature) ||
                        decl.isKind(SyntaxKind.PropertyAssignment)
                            ? decl.getType()
                            : null;
                }

                if (!propType) {
                    propType = resolvePropertyTypeByChecker(
                        this.checker,
                        prop,
                        rest.node
                    );
                }
            }

            if (!propType) {
                continue;
            }

            const propName = prop.getEscapedName();

            properties[propName] = this.convert({ type: propType, ...rest });

            if (!prop.isOptional()) {
                required.push(propName);
            }
        }

        const schema: any = {
            type: 'object',
            properties,
        };

        if (required.length > 0) {
            schema.required = required;
        }

        const indexType =
            type.getStringIndexType() || type.getNumberIndexType();

        if (indexType) {
            schema.indexedProperties = this.convert({
                type: indexType,
                ...rest,
            });
        }

        return schema;
    }
}
