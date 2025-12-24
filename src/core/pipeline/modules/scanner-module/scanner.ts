import { join } from 'path';
import {
    ModuleKind,
    ModuleResolutionKind,
    Project,
    SourceFile,
} from 'ts-morph';

import { DecoratorType } from '@interfaces';

import { INTERNAL_DECORATORS } from '../../../constants/decorators';
import { PipelineOptions } from '../../types';

export class ScannerModule {
    private project: Project;

    constructor(params?: { options?: PipelineOptions; project?: Project }) {
        this.project =
            params?.project ??
            new Project({
                tsConfigFilePath: join(process.cwd(), 'tsconfig.json'),
                skipAddingFilesFromTsConfig: false,
                skipFileDependencyResolution: true,
                compilerOptions: {
                    lib: ['lib.es2024.d.ts'],
                    strictNullChecks: true,
                    strict: true,

                    ...(!params?.options?.useExistingBuild && {
                        module: ModuleKind.CommonJS,
                        moduleResolution: ModuleResolutionKind.Node16,
                        outDir: './.apinni/build',
                    }),
                },
            });
    }

    public getProject() {
        return this.project;
    }

    public restartProject() {
        this.project = new Project({
            tsConfigFilePath: join(process.cwd(), 'tsconfig.json'),
            skipAddingFilesFromTsConfig: false,
            skipFileDependencyResolution: true,
            compilerOptions: this.project.getCompilerOptions(),
        });
    }

    public async traverseAndCacheTsMorph() {
        return new Promise(resolve => {
            this.project.getSourceFiles().forEach(sf => {
                sf.getReferencedSourceFiles();
                sf.getReferencingSourceFiles();
                sf.getClasses().map(cls => cls.getMethods());
            });

            resolve(true);
        });
    }

    public getFileTypeOfSourceFile(
        sourceFile: SourceFile,
        externalDecorators: Array<{ type: DecoratorType; name: string }> = []
    ) {
        const { decoratorTypeMap, decoratorNames } =
            this.prepareDecoratorsMap(externalDecorators);

        let fileType = null as DecoratorType | null;

        this.processDecoratorsInSourceFile(sourceFile, decoratorNames, name => {
            fileType = decoratorTypeMap.get(name)!;
            return fileType === 'run-time';
        });

        return { type: fileType };
    }

    public getSourceFilesWithDecorators(
        externalDecorators: Array<{ type: DecoratorType; name: string }> = []
    ) {
        const { decoratorTypeMap, decoratorNames } =
            this.prepareDecoratorsMap(externalDecorators);

        const filesWithDecorators: Array<{
            sourceFile: SourceFile;
            type: DecoratorType;
        }> = [];

        for (const sourceFile of this.project.getSourceFiles()) {
            let fileType = null as DecoratorType | null;

            this.processDecoratorsInSourceFile(
                sourceFile,
                decoratorNames,
                name => {
                    fileType = decoratorTypeMap.get(name)!;
                    return fileType === 'run-time';
                }
            );

            if (fileType) {
                filesWithDecorators.push({ sourceFile, type: fileType });
            }
        }

        return filesWithDecorators;
    }

    private buildDecoratorImportMapForSourceFile(
        sourceFile: SourceFile,
        decoratorNames: Set<string>
    ) {
        const map = new Map<string, string>();
        const decoratorsToSearch = new Set(decoratorNames);

        for (const imp of sourceFile.getImportDeclarations()) {
            for (const named of imp.getNamedImports()) {
                const exported = named.getNameNode().getText();
                const alias = named.getAliasNode()?.getText() ?? exported;

                if (decoratorsToSearch.has(exported)) {
                    map.set(alias, exported);
                    decoratorsToSearch.delete(exported);
                }
            }
        }

        // If no imports found - just keep 1 to 1 relation in case decorator defined in same file
        decoratorsToSearch.forEach(dec => map.set(dec, dec));

        return map;
    }

    private processDecoratorsInSourceFile(
        sourceFile: SourceFile,
        decoratorNames: Set<string>,
        callback: (name: string) => boolean
    ) {
        const importMap = this.buildDecoratorImportMapForSourceFile(
            sourceFile,
            decoratorNames
        );

        for (const classDecl of sourceFile.getClasses()) {
            // Check class decorators
            for (const dec of classDecl.getDecorators()) {
                const name = importMap.get(dec.getName());
                if (name) {
                    if (callback(name)) {
                        return;
                    }
                }
            }

            // Check method decorators
            for (const method of classDecl.getMethods()) {
                for (const dec of method.getDecorators()) {
                    const name = importMap.get(dec.getName());
                    if (name) {
                        if (callback(name)) {
                            return;
                        }
                    }
                }
            }
        }
    }

    private prepareDecoratorsMap(
        externalDecorators: Array<{ type: DecoratorType; name: string }> = []
    ) {
        const decoratorTypeMap = new Map<string, DecoratorType>([
            ...INTERNAL_DECORATORS.map(
                value => [value, 'compile-time'] as const
            ),
            ...externalDecorators.map(
                decorator => [decorator.name, decorator.type] as const
            ),
        ]);

        // For quick membership checks
        const decoratorNames = new Set(decoratorTypeMap.keys());

        return { decoratorTypeMap, decoratorNames };
    }
}
