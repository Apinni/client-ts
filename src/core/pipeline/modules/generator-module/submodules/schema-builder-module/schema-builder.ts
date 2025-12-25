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

import {
    AllOfSchema,
    AnyOfSchema,
    AnySchema,
    ArrayItemMeta,
    ArraySchema,
    BooleanSchema,
    EnumSchema,
    JsonSchema,
    NeverSchema,
    NullSchema,
    NumberSchema,
    ObjectSchema,
    SchemaBuilderEntry,
    StringSchema,
    TypesSchema,
    UndefinedSchema,
} from '../../types';
import {
    extractJSDocsToDefinitionProperties,
    mergeWithJSDocs,
    resolveNodeByType,
} from './utils';

const isBuiltInTypeSymbol = (symbol?: Symbol) => {
    const declarations = symbol?.getDeclarations() || [];
    if (!declarations.length) return false;

    return declarations.some(decl => {
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
        return { type: variable.getType(), node: variable.getTypeNode() };
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

const getTupleElementsMetadata = (type: Type) => {
    const targetType = type.getTargetType(); // It gonna unwrap everything to [?, ?, ..]

    if (!targetType) {
        return null;
    }

    const tsType = targetType.compilerType;

    const isTuple =
        (tsType.flags & ts.TypeFlags.Object) !== 0 &&
        ((tsType as ts.ObjectType).objectFlags & ts.ObjectFlags.Tuple) !== 0;

    if (!isTuple) return null;

    const tuple = tsType as ts.TupleType;

    const metadata = tuple.elementFlags.reduce(
        (acc, flag, index) => ({
            ...acc,
            [index]: {
                rest: (flag & ts.ElementFlags.Rest) !== 0,
                optional: (flag & ts.ElementFlags.Optional) !== 0,
                ...(tuple.labeledElementDeclarations?.[index] && {
                    name: tuple.labeledElementDeclarations[
                        index
                    ].name.getText(),
                }),
            },
        }),
        {} as Record<number, ArrayItemMeta>
    );

    return metadata;
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
            resolver: (): AnySchema => ({ type: 'any' }),
        },
        {
            condition: type => type.isNever(),
            resolver: (): NeverSchema => ({ type: 'never' }),
        },
        {
            condition: type => type.isUndefined(),
            resolver: (): UndefinedSchema => ({ type: 'undefined' }),
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

                return mergeWithJSDocs(
                    {
                        type: 'enum',
                        values,
                    },
                    type
                );
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
                const node = resolveNodeByType(wrappedType);
                return this.convert({ type: wrappedType, ...rest, node });
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
            seenSymbols?: Set<Symbol>;
            trace?: string[];
        }) => JsonSchema;
    }>;

    public generateSchema(entries: Array<SchemaBuilderEntry>): TypesSchema {
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

            const aliasSymbol = entry.type.getAliasSymbol();
            const targetAliasSymbol = entry.type
                .getTargetType()
                ?.getAliasSymbol();

            // If type is actually inline it - it will equal target type
            if (
                Boolean(aliasSymbol || targetAliasSymbol) &&
                aliasSymbol === targetAliasSymbol &&
                entry.node
            ) {
                const alias = entry.node.getSourceFile().addTypeAlias({
                    name: `__temp__${Date.now()}`,
                    type: entry.type.getText(),
                });
                const type = alias.getType();
                const node = alias.getTypeNode();

                schema[entry.name] = this.convert({
                    type,
                    node,
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
        seenSymbols = new Set<Symbol>(),
        trace = [],
    }: {
        type: Type;
        node?: Node;
        name?: string;
        reference?: string;
        seenSymbols?: Set<Symbol>;
        trace?: string[];
    }): JsonSchema {
        const aliasSymbol = type.getAliasSymbol();
        const targetAliasSymbol = type.getTargetType()?.getAliasSymbol();
        const symbol = type.getSymbol();

        const referenceMapName = name || '__default';

        if (!this.referencesMaps.has(referenceMapName)) {
            this.referencesMaps.set(referenceMapName, new Map());
        }

        if (trace.length > 100) {
            return {
                type: 'any',
            };
        }

        const referenceName =
            (!targetAliasSymbol || targetAliasSymbol === aliasSymbol) &&
            (aliasSymbol?.getName() || symbol?.getName());

        const identitySymbol =
            (!targetAliasSymbol || targetAliasSymbol === aliasSymbol) &&
            (aliasSymbol || symbol);

        // Check if the type is a literal (enum member access like Values.A)
        // These should be resolved to their literal values, not references
        const isLiteralType =
            type.isStringLiteral() ||
            type.isNumberLiteral() ||
            type.isBooleanLiteral();

        if (
            referenceName &&
            !['__type', '__object'].includes(referenceName) &&
            !referenceName.includes('__temp__') &&
            !isBuiltInTypeSymbol(type.getSymbol()) &&
            referenceName !== reference &&
            !isLiteralType
        ) {
            const args = type.getAliasTypeArguments();

            if (args.length > 0) {
                const clonedSeen = new Set(seenSymbols);
                if (identitySymbol) clonedSeen.add(identitySymbol);

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
                            seenSymbols: clonedSeen,
                        })
                    );
                }

                const target = type.getApparentType();

                return this.convert({
                    type: target,
                    node,
                    name: referenceMapName,
                    reference: referenceName,
                    seenSymbols: clonedSeen,
                    trace: [...trace, referenceMapName],
                });
            }

            if (
                !this.referencesMaps.get(referenceMapName)?.has(referenceName)
            ) {
                const clonedSeen = new Set(seenSymbols);
                if (identitySymbol) clonedSeen.add(identitySymbol);

                this.referencesMaps.get(referenceMapName)?.set(
                    referenceName,
                    this.convert({
                        type,
                        node,
                        name: referenceMapName,
                        reference: referenceName,
                        seenSymbols: clonedSeen,
                        trace: [...trace, referenceName],
                    })
                );
            }

            return {
                type: 'ref',
                name: referenceName,
            };
        }

        const resolver = this.handlers.find(handler =>
            handler.condition(type)
        )?.resolver;

        if (!resolver) {
            return {
                type: 'any',
            };
        }

        const result = resolver({
            type,
            node,
            name: referenceMapName,
            seenSymbols,
            trace: [...trace, referenceMapName],
        });

        return mergeWithJSDocs(result, type);
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
            items: this.convert({
                type: elementType,
                ...rest,
                node: resolveNodeByType(elementType),
            }),
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

        const metadata = getTupleElementsMetadata(type);

        const items = tupleTypes
            // .filter((_, index) => index !== restIndex)
            .map((tuple, index) => {
                return {
                    ...this.convert({
                        type: tuple,
                        ...rest,
                        node: resolveNodeByType(tuple),
                    }),
                    ...metadata?.[index],
                };
            });

        return {
            type: 'array',
            items,
        };
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
            return this.convert({
                type: unionTypes[0],
                ...rest,
                node: resolveNodeByType(unionTypes[0]) || rest.node,
            }) as JsonSchema;
        }

        const isMappedBoolean =
            unionTypes.some(
                union => union.isBooleanLiteral() && union.getText() === 'false'
            ) &&
            unionTypes.some(
                union => union.isBooleanLiteral() && union.getText() === 'true'
            );
        let filteredBoolean = unionTypes;
        if (isMappedBoolean) {
            filteredBoolean = unionTypes.filter(
                union => !union.isBooleanLiteral()
            );
        }

        const allLiterals =
            filteredBoolean.length > 0 &&
            filteredBoolean.every(union => union.isLiteral());

        if (allLiterals) {
            return {
                type: 'enum',
                values: filteredBoolean
                    .map(union => union.getLiteralValue())
                    .filter(Boolean) as EnumSchema['values'],
            };
        }

        if (!filteredBoolean.length && isMappedBoolean) {
            return mergeWithJSDocs({ type: 'boolean' }, type);
        }

        const definitions = [
            ...filteredBoolean.map(union =>
                this.convert({
                    type: union,
                    ...rest,
                    node: resolveNodeByType(union) || rest.node,
                })
            ),
            ...(isMappedBoolean ? [{ type: 'boolean' as const }] : []),
        ];

        return mergeWithJSDocs({ type: 'complex', anyOf: definitions }, type);
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
            this.convert({
                type: intersection,
                ...rest,
                node: resolveNodeByType(intersection) || rest.node,
            })
        );

        return mergeWithJSDocs({ type: 'complex', allOf: definitions }, type);
    }

    private handleObject({
        type,
        seenSymbols = new Set(),
        trace = [],
        ...rest
    }: {
        type: Type<ts.ObjectType>;
        node?: Node;
        name?: string;
        seenSymbols?: Set<Symbol>;
        trace?: string[];
    }): ObjectSchema {
        const properties: { [key: string]: any } = {};
        const required: string[] = [];

        const isMappedType = Boolean(type.getTargetType());

        for (const prop of type.getProperties()) {
            let propType: Type | null = null;

            if (isMappedType && !type.isClass() && rest.node) {
                propType = resolvePropertyTypeByChecker(
                    this.checker,
                    prop,
                    rest.node
                );
            } else {
                const decl = prop.getDeclarations()[0];

                if (decl && decl.isKind(SyntaxKind.MethodDeclaration)) {
                    continue;
                }

                if (
                    decl &&
                    (decl.isKind(SyntaxKind.PropertySignature) ||
                        decl.isKind(SyntaxKind.PropertyAssignment) ||
                        decl.isKind(SyntaxKind.PropertyDeclaration))
                ) {
                    // Try to get the type node first to preserve type aliases
                    if (
                        'getTypeNode' in decl &&
                        typeof decl.getTypeNode === 'function'
                    ) {
                        const typeNode = decl.getTypeNode();
                        if (typeNode) {
                            propType = typeNode.getType();
                        }
                    }

                    // Fall back to decl.getType() if no type node
                    if (!propType) {
                        propType = decl.getType();
                    }

                    // uncomment in future when add support of class transformation
                    // console.log(
                    //     decl.isKind(SyntaxKind.PropertyDeclaration) &&
                    //         decl
                    //             .getDecorators()
                    //             .map(decorator => decorator.getName())
                    // );
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

            const propNode =
                prop.getDeclarations()[0] ||
                (propType.getAliasSymbol()?.getDeclarations()[0] as Node) ||
                null;

            properties[propName] = {
                ...this.convert({
                    type: propType,
                    trace: [...trace, propName],
                    seenSymbols,
                    ...rest,
                    node: propNode || undefined,
                }),
                ...(Node.isJSDocable(propNode) &&
                    extractJSDocsToDefinitionProperties(propNode.getJsDocs())),
            };

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
                trace: [...trace, 'index_type'],
                ...rest,
            });
        }

        return {
            ...schema,
            ...(Node.isJSDocable(rest.node) &&
                extractJSDocsToDefinitionProperties(rest.node.getJsDocs())),
        };
    }
}
