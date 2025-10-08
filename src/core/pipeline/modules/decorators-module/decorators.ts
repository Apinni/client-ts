import { Decorator, SourceFile } from 'ts-morph';

import { DecoratorType } from '@interfaces';

export class DecoratorsModule {
    constructor() {}

    public processDecorators(
        params: {
            filesWithDecorators: Array<{
                sourceFile: SourceFile;
                type: DecoratorType;
            }>;
            modules: Map<string, any>;
        },
        onProcess: (args: {
            target: any;
            propertyKey?: string | symbol;
            decorator: Decorator;
            sourceFile: SourceFile;
        }) => boolean
    ): number {
        let processedDecorators = 0;

        for (const { sourceFile, type } of params.filesWithDecorators) {
            if (
                type === 'run-time' &&
                !params.modules.get(sourceFile.getFilePath())
            ) {
                continue;
            }

            const moduleExports = params.modules.get(sourceFile.getFilePath());

            for (const classDecl of sourceFile.getClasses()) {
                const className = classDecl.getName();
                const classTarget =
                    type === 'run-time'
                        ? (className && moduleExports[className]) ||
                          moduleExports.default
                        : `${sourceFile.getFilePath()}_${className}`;

                if (!classTarget) {
                    continue;
                }

                for (const decorator of classDecl.getDecorators()) {
                    const processed = onProcess({
                        target: classTarget,
                        decorator,
                        sourceFile,
                    });

                    if (processed) {
                        processedDecorators++;
                    }
                }

                for (const method of classDecl.getMethods()) {
                    const methodName = method.getName();

                    for (const decorator of method.getDecorators()) {
                        const processed = onProcess({
                            target: classTarget,
                            propertyKey: methodName,
                            decorator,
                            sourceFile,
                        });

                        if (processed) {
                            processedDecorators++;
                        }
                    }
                }
            }
        }

        return processedDecorators;
    }
}
