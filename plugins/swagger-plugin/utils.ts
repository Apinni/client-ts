import {
    ArrayLiteralExpression,
    Expression,
    Identifier,
    ObjectLiteralExpression,
    PropertyAssignment,
    SourceFile,
} from 'ts-morph';

export const combinePaths = (
    controllerPath: string | undefined,
    endpointPath: string
) => {
    const cleanControllerPath = controllerPath?.replace(/\/+$/, '') || '';
    const cleanEndpointPath = endpointPath.replace(/^\/+/, '');
    return cleanControllerPath + '/' + cleanEndpointPath;
};

// Helper to convert an ObjectLiteralExpression to a JS object
function objectLiteralToObject(objExpr: ObjectLiteralExpression): any {
    const result: any = {};
    objExpr.getProperties().forEach(prop => {
        if (prop.getKindName() === 'PropertyAssignment') {
            const pa = prop as PropertyAssignment;
            const name = pa.getName();
            const initializer = pa.getInitializer();
            if (initializer) {
                if (initializer.getKindName() === 'ObjectLiteralExpression') {
                    result[name] = objectLiteralToObject(
                        initializer as ObjectLiteralExpression
                    );
                } else if (
                    initializer.getKindName() === 'ArrayLiteralExpression'
                ) {
                    result[name] = (initializer as ArrayLiteralExpression)
                        .getElements()
                        .map((el: Expression) => el.getText());
                } else {
                    result[name] = initializer
                        .getText()
                        .replace(/^['"]|['"]$/g, '');
                }
            }
        }
        // Ignore SpreadAssignment and other types for now
    });
    return result;
}

// Main function to extract decorator argument value, resolving local and imported variables
export function extractDecoratorArgValue<T>(
    expr: Expression | undefined,
    sourceFile: SourceFile
): T | null {
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
