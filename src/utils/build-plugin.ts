import {
    ArrayLiteralExpression,
    Decorator,
    Expression,
    Identifier,
    NumericLiteral,
    ObjectLiteralExpression,
    PropertyAssignment,
    StringLiteral,
    SyntaxKind,
} from 'ts-morph';

import { ApinniPlugin, Dependency, OverridedContext } from '@interfaces';

export const buildPluginWithContext =
    <OverridedGlobalContext extends OverridedContext = OverridedContext>() =>
    <
        Dependencies extends Dependency[] = [],
        IsShareable extends boolean = false,
        SharedContext extends [IsShareable] extends [true] ? any : never = [
            IsShareable,
        ] extends [true]
            ? any
            : never,
    >(
        plugin: ApinniPlugin<
            OverridedGlobalContext,
            Dependencies,
            IsShareable,
            SharedContext
        >
    ) =>
        plugin as ApinniPlugin<
            OverridedGlobalContext,
            Dependencies,
            IsShareable,
            SharedContext
        >;

export const buildPlugin = <
    Dependencies extends Dependency[] = [],
    IsShareable extends boolean = false,
    SharedContext extends [IsShareable] extends [true] ? any : never = [
        IsShareable,
    ] extends [true]
        ? any
        : never,
>(
    plugin: ApinniPlugin<
        OverridedContext,
        Dependencies,
        IsShareable,
        SharedContext
    >
) =>
    plugin as ApinniPlugin<
        OverridedContext,
        Dependencies,
        IsShareable,
        SharedContext
    >;

function expressionToValue(expr: Expression): any {
    switch (expr.getKind()) {
        case SyntaxKind.StringLiteral:
            return (expr as StringLiteral).getLiteralText(); // unquoted
        case SyntaxKind.NumericLiteral:
            return Number((expr as NumericLiteral).getText());
        case SyntaxKind.TrueKeyword:
            return true;
        case SyntaxKind.FalseKeyword:
            return false;
        case SyntaxKind.ArrayLiteralExpression:
            return (expr as ArrayLiteralExpression)
                .getElements()
                .map(el => expressionToValue(el as Expression));
        case SyntaxKind.ObjectLiteralExpression:
            return objectLiteralToObject(expr as ObjectLiteralExpression);
        default:
            // fallback: identifiers or anything else
            return expr.getText();
    }
}

// Helper to convert an ObjectLiteralExpression to a JS object
function objectLiteralToObject(objExpr: ObjectLiteralExpression): any {
    const result: any = {};
    objExpr.getProperties().forEach(prop => {
        if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const pa = prop as PropertyAssignment;
            const nameNode = pa.getNameNode();
            let name: string;

            if (nameNode.isKind(SyntaxKind.StringLiteral)) {
                // Strips the quotes
                name = (nameNode as StringLiteral).getLiteralText();
            } else {
                // Identifier or computed name
                name = nameNode.getText();
            }

            const initializer = pa.getInitializer();
            if (initializer) {
                result[name] = expressionToValue(initializer);
            }
        }
        // Ignore SpreadAssignment etc. for now
    });
    return result;
}

// Main function to extract decorator argument value, resolving local and imported variables
export function extractDecoratorArgValue<T>(decorator: Decorator): T | null {
    const callExpr = decorator?.getCallExpression();
    const expr = callExpr?.getArguments()[0] as Expression | undefined;
    const sourceFile = decorator.getSourceFile();

    if (!expr) return null;

    if (expr.getKindName() === 'ObjectLiteralExpression') {
        // Inline object
        return objectLiteralToObject(expr as ObjectLiteralExpression) as T;
    } else if (expr.getKindName() === 'Identifier') {
        // It's a variable, try to resolve it
        const identifier = expr as Identifier;
        // Try to resolve local variable first
        const localDecl = sourceFile.getVariableDeclaration(
            identifier.getText()
        );
        if (localDecl) {
            const initializer = localDecl.getInitializer();
            if (
                initializer &&
                initializer.getKindName() === 'ObjectLiteralExpression'
            ) {
                return objectLiteralToObject(
                    initializer as ObjectLiteralExpression
                ) as T;
            }
        }
        // Try to resolve imported variable
        const importSpec = sourceFile
            .getImportDeclarations()
            .flatMap(imp => imp.getNamedImports())
            .find(spec => spec.getName() === identifier.getText());
        if (importSpec) {
            const importDecl = importSpec.getImportDeclaration();
            // Resolve the imported file
            const importedFile = importDecl.getModuleSpecifierSourceFile();
            if (importedFile) {
                const importedVar = importedFile.getVariableDeclaration(
                    identifier.getText()
                );
                if (importedVar) {
                    const initializer = importedVar.getInitializer();
                    if (
                        initializer &&
                        initializer.getKindName() === 'ObjectLiteralExpression'
                    ) {
                        return objectLiteralToObject(
                            initializer as ObjectLiteralExpression
                        ) as T;
                    }
                }
            }
        }
    }
    // Fallback: not supported
    return null;
}
