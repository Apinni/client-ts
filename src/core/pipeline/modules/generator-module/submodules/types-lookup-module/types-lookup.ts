import { join } from 'path';
import { Node, Project, SourceFile, Type, TypeFormatFlags } from 'ts-morph';

import {
    NamedInlineTypeEntry,
    NamedModelTypeEntry,
    NamedTsTypeEntry,
} from '../../types';
import {
    declarationHandlers,
    extractTypeReferences,
    isBuiltInType,
    resolveTypeofType,
} from './utils';

export class TypesLookupModule {
    private project: Project;

    private typeIndex = new Map<
        string,
        Array<{ node: Node; type: Type; sourceFile: SourceFile }>
    >();

    private qualifiedNames = new Map<Node, string>();

    private typeIndexQualified = new Map<
        string,
        { node: Node; type: Type; sourceFile: SourceFile }
    >();

    constructor(project?: Project) {
        this.project =
            project ??
            new Project({
                tsConfigFilePath: join(process.cwd(), 'tsconfig.json'),
                skipAddingFilesFromTsConfig: false,
                skipFileDependencyResolution: true,
            });
    }

    public buildTypeIndexes() {
        console.log({
            buildingWithSourceFiles: this.project.getSourceFiles().length,
        });
        for (const sourceFile of this.project.getSourceFiles()) {
            if (sourceFile.getFullText().includes('Auto-generated API types')) {
                continue;
            }
            sourceFile.getInterfaces().forEach(node => {
                const name = node.getName();
                this.addToTypeIndex(name, node, node.getType(), sourceFile);
            });
            sourceFile.getClasses().forEach(node => {
                const name = node.getName();
                if (name)
                    this.addToTypeIndex(name, node, node.getType(), sourceFile);
            });
            sourceFile.getTypeAliases().forEach(node => {
                const name = node.getName();
                this.addToTypeIndex(
                    name,
                    node.getTypeNode()!,
                    node.getType(),
                    sourceFile
                );
            });
            sourceFile.getEnums().forEach(node => {
                const name = node.getName();
                this.addToTypeIndex(name, node, node.getType(), sourceFile);
            });
            sourceFile.getVariableDeclarations().forEach(node => {
                const name = node.getName();
                if (node.getTypeNode()?.getText().startsWith('typeof ')) {
                    const resolved = resolveTypeofType(node.getTypeNode()!);
                    if (resolved)
                        this.addToTypeIndex(
                            name,
                            node.getTypeNode()!,
                            node.getType(),
                            sourceFile
                        );
                }
            });
        }

        // Assign qualified names for duplicates
        for (const [name, infos] of this.typeIndex) {
            if (infos.length > 1) {
                infos.forEach((info, index) => {
                    const qName = `${name}_${index + 1}`;
                    this.qualifiedNames.set(info.node, qName);
                    this.typeIndexQualified.set(qName, info);
                });
            } else {
                infos.forEach(info => {
                    const qName = name;
                    this.qualifiedNames.set(info.node, qName);
                    this.typeIndexQualified.set(qName, info);
                });
            }
        }

        console.log({ typesAmount: this.typeIndexQualified.size });
    }

    private addToTypeIndex(
        name: string,
        node: Node,
        type: Type,
        sourceFile: SourceFile
    ) {
        const existing = this.typeIndex.get(name) || [];
        this.typeIndex.set(name, [...existing, { node, type, sourceFile }]);
    }

    lookup(types: Array<string>) {
        const names = this.extractTypeNames(types);

        const definitions = this.searchTypeDefinitions(names);

        return definitions;
    }

    lookupNode(types: NamedModelTypeEntry[]) {
        const typeNodes: Array<NamedTsTypeEntry | NamedInlineTypeEntry> = [];

        for (const type of types) {
            if ((this.typeIndex.get(type.model)?.length || 0) > 1) {
                throw new Error(
                    `Multiple definition declarations found for ${type.model} [${type.name}]`
                );
            }

            const data = this.typeIndexQualified.get(type.model);
            if (!data) {
                // console.warn(
                //     `Unable to find definition declaration for ${type.model} [${type.name}]`
                // );
                typeNodes.push({
                    name: type.name,
                    inline: 'any',
                });
                continue;
            }

            // const start = performance.now();

            // const typeText = data.node.getText(); // syntactic, fast
            // const typeSymbol = Node.isClassDeclaration(data.node) getType();
            // const typeName = typeSymbol?.getName(); // often enough

            // console.log({ typeText, typeSymbol, typeName });

            typeNodes.push({
                type: data.type,
                node: data.node,
                name: type.name,
            });

            // console.log(
            //     `${type.name} resolved .getType() in `,
            //     performance.now() - start
            // );
        }

        return typeNodes;
    }

    private getNodeName(node: Node): string | undefined {
        if (
            Node.isInterfaceDeclaration(node) ||
            Node.isTypeAliasDeclaration(node) ||
            Node.isEnumDeclaration(node) ||
            Node.isClassDeclaration(node) ||
            Node.isVariableDeclaration(node)
        ) {
            return node.getName();
        }
        return undefined;
    }

    private searchTypeDefinitions(names: Array<string>) {
        for (const name of names) {
            if (
                (this.typeIndex.get(name)?.length || 0) > 1 &&
                !this.typeIndexQualified.has(name)
            ) {
                throw new Error(
                    `Multiple definition declarations found for ${name}`
                );
            }
        }

        const typeDefinitions: string[] = [];
        const processedTypes = new Set<string>();
        const typeQueue = [...names];

        while (typeQueue.length > 0) {
            const currentType = typeQueue.shift()!;
            if (processedTypes.has(currentType)) continue;

            const typeInfo = this.typeIndexQualified.get(currentType);
            if (!typeInfo) {
                // Check if the type is in typeIndex (unqualified) and resolve to qualified names
                const infos = this.typeIndex.get(currentType);
                if (infos && infos.length > 0) {
                    infos.forEach(info => {
                        const qName = this.qualifiedNames.get(info.node);
                        if (
                            qName &&
                            !processedTypes.has(qName) &&
                            !typeQueue.includes(qName)
                        ) {
                            typeQueue.push(qName);
                        }
                    });
                }
                continue;
            }

            const originalName = this.getNodeName(typeInfo.node) ?? currentType;
            const qualifiedName =
                this.qualifiedNames.get(typeInfo.node) ?? currentType;

            const handler = declarationHandlers.find(h =>
                h.getDeclaration(typeInfo.sourceFile, originalName)
            ) || {
                getText: (node: Node) =>
                    node
                        .getType()
                        .getText(undefined, TypeFormatFlags.NoTruncation),
            };

            let definition = handler.getText(typeInfo.node);

            // Replace the type name with its qualified name
            if (qualifiedName !== originalName) {
                definition = definition.replace(
                    new RegExp(`\\b${originalName}\\b`, 'g'),
                    qualifiedName
                );
            }

            // Update references to qualified names
            const refReplacements = new Map<string, string>();

            typeInfo.node.forEachDescendant(desc => {
                if (Node.isTypeReference(desc)) {
                    const typeNameNode = desc.getTypeName();
                    if (Node.isIdentifier(typeNameNode)) {
                        const refName = typeNameNode.getText();
                        if (
                            isBuiltInType(refName) ||
                            refReplacements.has(refName)
                        )
                            return;
                        const symbol = typeNameNode.getSymbol();
                        if (!symbol) return;
                        const targetSymbol =
                            symbol.getAliasedSymbol() || symbol;
                        const decls = targetSymbol.getDeclarations();
                        if (decls.length === 0) return;
                        const targetDecl = decls[0];
                        const qName = this.qualifiedNames.get(targetDecl);
                        if (qName && qName !== refName) {
                            refReplacements.set(refName, qName);
                        }
                    }
                    // Handle generic type arguments
                    desc.getTypeArguments().forEach(arg => {
                        if (Node.isTypeReference(arg)) {
                            const typeNameNode = arg.getTypeName();
                            if (Node.isIdentifier(typeNameNode)) {
                                const refName = typeNameNode.getText();
                                if (
                                    isBuiltInType(refName) ||
                                    refReplacements.has(refName)
                                )
                                    return;
                                const symbol = typeNameNode.getSymbol();
                                if (!symbol) return;
                                const targetSymbol =
                                    symbol.getAliasedSymbol() || symbol;
                                const decls = targetSymbol.getDeclarations();
                                if (decls.length === 0) return;
                                const targetDecl = decls[0];
                                const qName =
                                    this.qualifiedNames.get(targetDecl);
                                if (qName && qName !== refName) {
                                    refReplacements.set(refName, qName);
                                }
                            }
                        }
                    });
                }
            });

            for (const [original, replacement] of refReplacements) {
                definition = definition.replace(
                    new RegExp(`\\b${original}\\b`, 'g'),
                    replacement
                );
            }

            typeDefinitions.push(definition);

            const references = this.extractTypeReferences(typeInfo.node);

            references.forEach(ref => {
                if (
                    !processedTypes.has(ref) &&
                    !typeQueue.includes(ref) &&
                    !isBuiltInType(ref)
                ) {
                    typeQueue.push(ref);
                }
            });

            processedTypes.add(currentType);
        }

        return typeDefinitions;
    }

    private extractTypeNames(types: Array<string>) {
        const typePattern = /([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const names = new Set<string>();

        for (const typeStr of types) {
            if (typeStr) {
                const matches = typeStr.match(typePattern);
                if (matches) {
                    matches.forEach(match => {
                        if (!isBuiltInType(match)) {
                            // Check if the type has a qualified name
                            const infos = this.typeIndex.get(match);
                            if (infos) {
                                infos.forEach(info => {
                                    const qName =
                                        this.qualifiedNames.get(info.node) ??
                                        match;
                                    names.add(qName);
                                });
                            } else {
                                names.add(match);
                            }
                        }
                    });
                }
            }
        }

        return [...names];
    }

    private extractTypeReferences(node: Node): string[] {
        const refs = new Set<string>();

        node.forEachDescendant(desc => {
            if (Node.isTypeReference(desc)) {
                const typeNameNode = desc.getTypeName();
                if (Node.isIdentifier(typeNameNode)) {
                    const refName = typeNameNode.getText();
                    if (isBuiltInType(refName)) return;
                    const symbol = typeNameNode.getSymbol();
                    if (!symbol) return;
                    const targetSymbol = symbol.getAliasedSymbol() || symbol;
                    const decls = targetSymbol.getDeclarations();
                    if (decls.length === 0) return;
                    const targetDecl = decls[0];
                    const qName =
                        this.qualifiedNames.get(targetDecl) ?? refName;
                    refs.add(qName);
                }
                // Handle generic type arguments
                desc.getTypeArguments().forEach(arg => {
                    if (Node.isTypeReference(arg)) {
                        const typeNameNode = arg.getTypeName();
                        if (Node.isIdentifier(typeNameNode)) {
                            const refName = typeNameNode.getText();
                            if (isBuiltInType(refName)) return;
                            const symbol = typeNameNode.getSymbol();
                            if (!symbol) return;
                            const targetSymbol =
                                symbol.getAliasedSymbol() || symbol;
                            const decls = targetSymbol.getDeclarations();
                            if (decls.length === 0) return;
                            const targetDecl = decls[0];
                            const qName =
                                this.qualifiedNames.get(targetDecl) ?? refName;
                            refs.add(qName);
                        }
                    }
                });
            }
        });

        return [...refs];
    }
}
