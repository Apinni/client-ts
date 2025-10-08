import { Listr, PRESET_TIMER } from 'listr2';
import { SourceFile } from 'ts-morph';

import { ApinniConfig, DecoratorType } from '@interfaces';

import { DecoratorRegistry } from '../decorator-registry';
import { GenerationContext } from '../generation-context';
import { CompilerModule } from './modules/compiler-module/compiler';
import { DecoratorsModule } from './modules/decorators-module/decorators';
import { GeneratorModule } from './modules/generator-module/generator';
import { ImporterModule } from './modules/importer-module/importer';
import { PluginManagerModule } from './modules/plugin-manager-module/plugin-manager';
import { ScannerModule } from './modules/scanner-module/scanner';
import { PipelineOptions } from './types';

export class Pipeline {
    private decoratorRegistry: DecoratorRegistry;
    private pluginManager: PluginManagerModule;
    private scannerModule: ScannerModule;
    private compilerModule: CompilerModule;
    private importerModule: ImporterModule;
    private decoratorsModule: DecoratorsModule;
    private generatorModule: GeneratorModule;

    constructor(
        config: ApinniConfig,
        private options: PipelineOptions
    ) {
        this.decoratorRegistry = new DecoratorRegistry();
        this.pluginManager = new PluginManagerModule(config);
        this.scannerModule = new ScannerModule();
        this.compilerModule = new CompilerModule();
        this.importerModule = new ImporterModule();
        this.decoratorsModule = new DecoratorsModule();
        this.generatorModule = new GeneratorModule(
            config,
            this.scannerModule.getProject()
        );
    }

    async run() {
        const tasks = new Listr(
            [
                {
                    title: 'Preparation Phase',
                    task: (_, task) => {
                        return task.newListr([
                            {
                                title: 'Caching referencing files',
                                task: async () => {
                                    await this.scannerModule.traverseAndCacheTsMorph();
                                },
                            },
                            {
                                title: 'Initializing plugins',
                                task: async (_, subTask) => {
                                    await this.pluginManager.executeHook(
                                        'onInitialize',
                                        {
                                            register: definition =>
                                                this.decoratorRegistry.register(
                                                    definition
                                                ),
                                        }
                                    );

                                    const pluginsCount =
                                        this.pluginManager.getPluginsCount();

                                    subTask.title += ` (${pluginsCount} plugin${pluginsCount === 1 ? '' : 's'} loaded)`;
                                },
                            },
                        ]);
                    },
                },
                {
                    title: 'Core Processing',
                    // @ts-expect-error Injecting isolated context
                    task: (ctx, task) => {
                        return task.newListr(
                            [
                                {
                                    title: 'Scanning for decorators',
                                    task: (subCtx, subTask) => {
                                        const filesWithDecorators =
                                            this.scannerModule.getSourceFilesWithDecorators(
                                                this.decoratorRegistry.getRegisteredDecorators()
                                            );

                                        ctx.filesWithDecorators =
                                            filesWithDecorators;

                                        subCtx.filesToImport =
                                            filesWithDecorators
                                                .filter(
                                                    ({ type }) =>
                                                        type === 'run-time'
                                                )
                                                .map(
                                                    ({ sourceFile }) =>
                                                        sourceFile
                                                );

                                        const total =
                                            filesWithDecorators.length;

                                        subTask.title += `(${total} file${total === 1 ? '' : 's'} found)`;
                                    },
                                },
                                {
                                    title: 'Compiling files with decorators',
                                    task: async (subCtx, subTask) => {
                                        if (this.options.useExistingBuild) {
                                            return subTask.skip(
                                                'Skipped compilation (using existing build)'
                                            );
                                        }

                                        const compiledFiles =
                                            await this.compilerModule.compileFiles(
                                                subCtx.filesToImport,
                                                {
                                                    force: false,
                                                }
                                            );

                                        subTask.title += ` (${compiledFiles} file${compiledFiles === 1 ? '' : 's'} compiled)`;
                                    },
                                },
                                {
                                    title: 'Resolving decorators',
                                    task: async (subCtx, subTask) => {
                                        return subTask.newListr(
                                            [
                                                {
                                                    title: 'Loading modules',
                                                    task: async (
                                                        nestedContext,
                                                        nestedTask
                                                    ) => {
                                                        nestedContext.modules =
                                                            await this.importerModule.import(
                                                                subCtx.filesToImport
                                                            );

                                                        const total =
                                                            nestedContext
                                                                .modules.size;

                                                        nestedTask.title += ` (${total} module${total === 1 ? '' : 's'} loaded)`;
                                                    },
                                                },
                                                {
                                                    title: 'Processing decorators',
                                                    task: async (
                                                        nestedContext,
                                                        nestedTask
                                                    ) => {
                                                        const processed =
                                                            this.decoratorsModule.processDecorators(
                                                                {
                                                                    filesWithDecorators:
                                                                        ctx.filesWithDecorators,
                                                                    modules:
                                                                        nestedContext.modules,
                                                                },
                                                                params =>
                                                                    this.decoratorRegistry.processEvent(
                                                                        'register',
                                                                        params
                                                                    )
                                                            );

                                                        nestedTask.title += ` (${processed} decorator${processed === 1 ? '' : 's'} processed)`;
                                                    },
                                                },
                                            ],
                                            {
                                                ctx: {
                                                    modules: new Map<
                                                        string,
                                                        any
                                                    >(),
                                                },
                                            }
                                        );
                                    },
                                },
                            ],
                            {
                                ctx: {
                                    filesToImport: [] as Array<SourceFile>,
                                },
                            }
                        );
                    },
                },
                {
                    title: 'Finalization',
                    task: (_, task) => {
                        return task.newListr([
                            {
                                title: 'Executing plugin hooks',
                                task: async () => {
                                    await this.pluginManager.executeHook(
                                        'onAfterDecoratorsProcessed'
                                    );

                                    await this.pluginManager.executeHook(
                                        'onConsumeDependencyContexts'
                                    );

                                    const context =
                                        GenerationContext.getInstance();

                                    await this.pluginManager.executeHook(
                                        'onRegisterMetadata',
                                        {
                                            registerClassMetadata: (...args) =>
                                                context.registerClassMetadata(
                                                    ...args
                                                ),
                                            registerMethodMetadata: (...args) =>
                                                context.registerMethodMetadata(
                                                    ...args
                                                ),
                                        }
                                    );
                                },
                            },
                            {
                                title: 'Generating types',
                                task: async () => {
                                    const context =
                                        GenerationContext.getInstance();

                                    await this.generatorModule.generate(
                                        context.getPreparedData()
                                    );
                                },
                            },
                        ]);
                    },
                },
            ],
            {
                rendererOptions: {
                    timer: PRESET_TIMER,
                    collapseSubtasks: false,
                },
                ctx: {
                    filesWithDecorators: [] as Array<{
                        sourceFile: SourceFile;
                        type: DecoratorType;
                    }>,
                },
            }
        );

        await tasks.run();
    }
}
