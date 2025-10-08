import {
    ClassDeclaration,
    ExpressionWithTypeArguments,
    HeritageClause,
    InterfaceDeclaration,
    Node,
    SourceFile,
    SyntaxKind,
    TypeAliasDeclaration,
    TypeFormatFlags,
    TypeLiteralNode,
    TypeReferenceNode,
} from 'ts-morph';

const BUILTIN_TYPES = new Set([
    'Omit',
    'Pick',
    'Partial',
    'Readonly',
    'Array',
    'Record',
    'any',
    'string',
    'number',
    'boolean',
    'unknown',
    'void',
    'never',
    'Object',
    'Date',
    'Promise',
    'Error',
    'Map',
    'Set',
    'Uint8Array',
    'Buffer',
    'null',
    'undefined',
    'bigint',
    'symbol',
    'Function',
    'RegExp',
    'Iterable',
    'Iterator',
    'ReadonlyArray',
    'TemplateStringsArray',
    'ThisType',
    'Required',
    'InstanceType',
    'ReturnType',
    'Parameters',
    'ConstructorParameters',
    'NonNullable',
    'Extract',
    'Exclude',
    'Awaited',
    'Uppercase',
    'Lowercase',
    'Capitalize',
    'Uncapitalize',
]);

export const isBuiltInType = (name: string): boolean => BUILTIN_TYPES.has(name);

export const resolveTypeofType = (typeNode: Node): string | undefined => {
    if (typeNode.getKindName() !== 'TypeQuery') return undefined;
    const expr = (typeNode as any).getExprName
        ? (typeNode as any).getExprName()
        : typeNode.getFirstChildByKind(SyntaxKind.Identifier);
    const identifier = expr ? expr.getText() : undefined;
    if (!identifier) return undefined;

    for (const sourceFile of typeNode.getProject().getSourceFiles()) {
        const varDecl = sourceFile.getVariableDeclaration(identifier);
        if (varDecl) {
            const typeText = varDecl
                .getType()
                .getText(undefined, TypeFormatFlags.NoTruncation);
            return typeText;
        }
        const enumDecl = sourceFile.getEnum(identifier);
        if (enumDecl) {
            return enumDecl.getName();
        }
        const classDecl = sourceFile.getClass(identifier);
        if (classDecl) {
            const name = classDecl.getName();
            if (name) {
                return name;
            }
        }
        const typeAlias = sourceFile.getTypeAlias(identifier);
        if (typeAlias) {
            return typeAlias.getName();
        }
        const iface = sourceFile.getInterface(identifier);
        if (iface) {
            return iface.getName();
        }
    }
    return undefined;
};

export function extractTypeReferences(node: Node): Set<string> {
    const references = new Set<string>();
    node.forEachDescendant(descendant => {
        if (Node.isTypeReference(descendant)) {
            const typeName = (descendant as TypeReferenceNode)
                .getTypeName()
                .getText();
            if (typeName && !isBuiltInType(typeName)) references.add(typeName);
        } else if (Node.isHeritageClause(descendant)) {
            (descendant as HeritageClause).getTypeNodes().forEach(typeNode => {
                const typeName = typeNode.getText();
                if (!isBuiltInType(typeName)) references.add(typeName);
            });
        } else if (Node.isExpressionWithTypeArguments(descendant)) {
            const typeName = (descendant as ExpressionWithTypeArguments)
                .getExpression()
                .getText();
            if (!isBuiltInType(typeName)) references.add(typeName);
        }
    });

    return references;
}

function convertClassToType(classDecl: ClassDeclaration): string {
    const lines: string[] = [`export type ${classDecl.getName()} = {`];
    for (const prop of classDecl.getProperties()) {
        if (
            prop.hasModifier('private') ||
            prop.hasModifier('protected') ||
            prop.isStatic()
        )
            continue;
        let typeText = prop.getTypeNode()?.getText() ?? 'any';
        if (prop.getTypeNode()?.getText().startsWith('typeof ')) {
            const resolved = resolveTypeofType(prop.getTypeNode()!);
            if (resolved) typeText = resolved;
        }
        lines.push(
            `  ${prop.getName()}${
                prop.hasQuestionToken() ? '?' : ''
            }: ${typeText};`
        );
    }
    for (const getter of classDecl.getGetAccessors()) {
        if (
            getter.hasModifier('private') ||
            getter.hasModifier('protected') ||
            getter.isStatic()
        )
            continue;
        lines.push(
            `  readonly ${getter.getName()}: ${
                getter.getReturnTypeNode()?.getText() ?? 'any'
            };`
        );
    }
    for (const method of classDecl.getMethods()) {
        if (
            method.hasModifier('private') ||
            method.hasModifier('protected') ||
            method.isStatic() ||
            method.getName() === 'constructor'
        )
            continue;
        const params = method
            .getParameters()
            .map(
                param =>
                    `${param.getName()}: ${
                        param.getTypeNode()?.getText() ?? 'any'
                    }`
            )
            .join(', ');
        lines.push(
            `  ${method.getName()}(${params}): ${
                method.getReturnTypeNode()?.getText() ?? 'any'
            };`
        );
    }
    lines.push('}');
    return lines.join('\n');
}

interface DeclarationHandler {
    getDeclaration: (
        sourceFile: SourceFile,
        typeName: string
    ) => Node | undefined;
    getText: (node: Node) => string;
}

export const declarationHandlers: DeclarationHandler[] = [
    {
        getDeclaration: (sourceFile, typeName) =>
            sourceFile.getInterface(typeName),
        getText: node =>
            Node.isInterfaceDeclaration(node)
                ? convertInterfaceToString(node)
                : node.getText(),
    },
    {
        getDeclaration: (sourceFile, typeName) => sourceFile.getClass(typeName),
        getText: node =>
            Node.isClassDeclaration(node)
                ? convertClassToType(node)
                : node.getText(),
    },
    {
        getDeclaration: (sourceFile, typeName) =>
            sourceFile.getTypeAlias(typeName),
        getText: node =>
            Node.isTypeAliasDeclaration(node)
                ? convertTypeAliasToString(node)
                : node.getText(),
    },
    {
        getDeclaration: (sourceFile, typeName) => sourceFile.getEnum(typeName),
        getText: node => node.getText(),
    },
];

function convertInterfaceToString(interfaceDecl: InterfaceDeclaration): string {
    const extendsClauses = interfaceDecl
        .getExtends()
        .map(ext => ext.getText())
        .join(' & ');

    const lines: string[] = [
        `export type ${interfaceDecl.getName()} = ${extendsClauses ? `${extendsClauses} & ` : ''}{`,
    ];
    for (const prop of interfaceDecl.getProperties()) {
        let typeText = prop.getTypeNode()?.getText() ?? 'any';
        if (prop.getTypeNode()?.getText().startsWith('typeof ')) {
            const resolved = resolveTypeofType(prop.getTypeNode()!);
            if (resolved) typeText = resolved;
        }
        lines.push(
            `  ${prop.getName()}${
                prop.hasQuestionToken() ? '?' : ''
            }: ${typeText};`
        );
    }
    for (const sig of interfaceDecl.getCallSignatures()) {
        lines.push(`  ${sig.getText()}`);
    }
    for (const idx of interfaceDecl.getIndexSignatures()) {
        lines.push(`  ${idx.getText()}`);
    }
    for (const method of interfaceDecl.getMethods()) {
        const params = method
            .getParameters()
            .map(
                param =>
                    `${param.getName()}: ${
                        param.getTypeNode()?.getText() ?? 'any'
                    }`
            )
            .join(', ');
        lines.push(
            `  ${method.getName()}(${params}): ${
                method.getReturnTypeNode()?.getText() ?? 'any'
            };`
        );
    }
    lines.push('}');
    return lines.join('\n');
}

function convertTypeAliasToString(typeAliasDecl: TypeAliasDeclaration): string {
    const typeNode = typeAliasDecl.getTypeNode();
    let typeText = typeNode?.getText() ?? 'any';
    if (typeNode && typeText.startsWith('typeof ')) {
        const resolved = resolveTypeofType(typeNode);
        if (resolved) typeText = resolved;
    }
    if (typeNode && typeNode.getKindName() === 'TypeLiteral') {
        const lines: string[] = ['{'];
        for (const member of (typeNode as TypeLiteralNode).getProperties?.() ||
            []) {
            let memberTypeText = member.getTypeNode?.()?.getText() ?? 'any';
            if (member.getTypeNode?.()?.getText().startsWith('typeof ')) {
                const resolved = resolveTypeofType(member.getTypeNode()!);
                if (resolved) memberTypeText = resolved;
            }

            lines.push(
                `  ${member.getName?.() ?? ''}${
                    member.hasQuestionToken?.() ? '?' : ''
                }: ${memberTypeText};`
            );
        }
        lines.push('}');
    }

    const typeParameters = typeAliasDecl.getTypeParameters();
    let genericText = '';
    if (typeParameters.length > 0) {
        genericText = `<${typeParameters
            .map(param => {
                const paramName = param.getName();
                const constraint = param.getConstraint()?.getText();
                const defaultType = param.getDefault()?.getText();
                let result = paramName;
                if (constraint) {
                    result += ` extends ${constraint}`;
                }
                if (defaultType) {
                    result += ` = ${defaultType}`;
                }
                return result;
            })
            .join(', ')}>`;
    }

    return `export type ${typeAliasDecl.getName()}${genericText} = ${typeText};`;
}
