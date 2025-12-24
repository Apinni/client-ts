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
    });
    return result;
}

export function extractDecoratorArgValue<T>(
    expr: Expression | undefined,
    sourceFile: SourceFile
): T | null {
    if (!expr) return null;

    if (expr.getKindName() === 'ObjectLiteralExpression') {
        return objectLiteralToObject(expr as ObjectLiteralExpression) as T;
    } else if (expr.getKindName() === 'Identifier') {
        const identifier = expr as Identifier;
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
        const importSpec = sourceFile
            .getImportDeclarations()
            .flatMap(imp => imp.getNamedImports())
            .find(spec => spec.getName() === identifier.getText());
        if (importSpec) {
            const importDecl = importSpec.getImportDeclaration();
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
    return null;
}
