import chokidar from 'chokidar';
import { join } from 'path';
import { Decorator, SourceFile } from 'ts-morph';

import { ApinniConfig, DecoratorType } from '@interfaces';

import { DecoratorRegistry } from '../decorator-registry';
import { GenerationContext } from '../generation-context';
import {
    logError,
    logEventComplete,
    logEventStart,
    logInfo,
    logStartup,
    logWarn,
    logWatchingStart,
} from './logs-helper';
import { CompilerModule } from './modules/compiler-module/compiler';
import { DecoratorsModule } from './modules/decorators-module/decorators';
import { GeneratorModule } from './modules/generator-module/generator';
import { ImporterModule } from './modules/importer-module/importer';
import { PluginManagerModule } from './modules/plugin-manager-module/plugin-manager';
import { ScannerModule } from './modules/scanner-module/scanner';
import { PipelineOptions } from './types';

type FileEvent = 'add' | 'change' | 'unlink' | 'coldStart';

interface EventAction {
    event: FileEvent;
    path?: string;
}

export class Watcher {
    private decoratorRegistry: DecoratorRegistry;
    private pluginManager: PluginManagerModule;
    private scannerModule: ScannerModule;
    private compilerModule: CompilerModule;
    private importerModule: ImporterModule;
    private decoratorsModule: DecoratorsModule;
    private localModuleContext: Map<string, any> = new Map();
    private registeredParams: Map<
        string,
        {
            target: any;
            decorator: Decorator;
            propertyKey?: string | symbol;
        }[]
    > = new Map(); // Cache for registered decorator params per file
    private isProcessing = false;
    private actionsQueue: EventAction[] = [];

    constructor(private config: ApinniConfig) {
        this.decoratorRegistry = new DecoratorRegistry();
        this.pluginManager = new PluginManagerModule(config);
        this.scannerModule = new ScannerModule();
        this.compilerModule = new CompilerModule();
        this.importerModule = new ImporterModule();
        this.decoratorsModule = new DecoratorsModule();
    }

    async run() {
        logStartup('1.0.0');

        await this.coldStart();

        logWatchingStart();

        const watcher = chokidar.watch('.', {
            persistent: true,
            ignoreInitial: true,
            ignored: [
                'node_modules',
                '.apinni',
                'build',
                'dist',
                (path: string, stats?: any) =>
                    Boolean(
                        stats?.isFile() &&
                            (path.endsWith('.d.ts') || !path.endsWith('.ts'))
                    ),
            ],
        });

        watcher.on('add', async (path: string) => {
            this.actionsQueue.push({ event: 'add', path });
            await this.processChanges();
        });

        watcher.on('change', async (path: string) => {
            this.actionsQueue.push({ event: 'change', path });
            await this.processChanges();
        });

        watcher.on('unlink', async (path: string) => {
            this.actionsQueue.push({ event: 'unlink', path });
            await this.processChanges();
        });
    }

    private async coldStart() {
        this.actionsQueue.push({ event: 'coldStart' });
        await this.processChanges();
    }

    private async processChanges() {
        if (this.isProcessing || this.actionsQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const action = this.actionsQueue.shift();

        try {
            if (action) {
                await this.handleEvent(action);
            }
        } catch (error) {
            console.error(`Error processing event: ${error}`);
        } finally {
            this.isProcessing = false;
            if (this.actionsQueue.length > 0) {
                await this.processChanges();
            }
        }
    }

    private async handleEvent(action: EventAction) {
        const start = performance.now();

        const { event, path } = action;

        logEventStart(event, path);

        // Step 1: Initialize plugins and registry (only for coldStart)
        if (event === 'coldStart') {
            try {
                await this.pluginManager.executeHook(
                    'onInitialize',
                    {
                        register: (definition: any) =>
                            this.decoratorRegistry.register(definition),
                    },
                    'watch'
                );

                logInfo(
                    `Initialized plugins: ${this.pluginManager.getPluginsCount()}`
                );

                try {
                    const registeredDecorators =
                        this.decoratorRegistry.getRegisteredDecorators();
                    const filesWithDecorators =
                        this.scannerModule.getSourceFilesWithDecorators(
                            registeredDecorators
                        );
                    logInfo(
                        `Found ${filesWithDecorators.length} files with decorators`
                    );
                } catch (err) {
                    logWarn(
                        `Could not evaluate files with decorators: ${String(err)}`
                    );
                }
            } catch (err) {
                logError(`Plugin initialization failed: ${String(err)}`);
            }
        }

        let affectedFilesWithDecorators: Array<{
            sourceFile: SourceFile;
            type: DecoratorType;
        }> = [];
        let normalizedPath: string | undefined;
        if (path) {
            normalizedPath = join(process.cwd(), path);
        }

        // Step 2: Unregister decorators using cache (for change/unlink, or add if previously cached)
        if (['add', 'change', 'unlink'].includes(event) && normalizedPath) {
            const affectedPaths = this.getAffectedFilePaths(event, path);

            for (const filePath of affectedPaths) {
                const paramsList = this.registeredParams.get(filePath) || [];
                for (const params of paramsList) {
                    this.decoratorRegistry.processEvent('unregister', params);
                }

                const targets = new Set(paramsList.map(({ target }) => target));
                for (const target of targets) {
                    GenerationContext.getInstance().removeMetadataByTarget(
                        target
                    );
                }
                this.registeredParams.delete(filePath);
            }
        }

        // Step 3: Update the ts-morph project
        await this.updateProject(event, path);

        // Step 4: Get affected files with decorators for registration (excludes deleted base file)
        affectedFilesWithDecorators = this.getAffectedFilesWithDecorators(
            event,
            path
        );

        // Step 5: Compile and import runtime files if needed (not for unlink without affected)
        let updatedModules = new Map<string, any>();
        if (event !== 'unlink' || affectedFilesWithDecorators.length > 0) {
            const filesToImport = this.filterRuntimeFiles(
                affectedFilesWithDecorators
            );
            if (filesToImport.length > 0) {
                await this.compilerModule.compileFiles(filesToImport, {
                    force: event === 'coldStart',
                });
                updatedModules =
                    await this.importerModule.import(filesToImport);
                updatedModules.forEach((value, key) =>
                    this.localModuleContext.set(key, value)
                );
            }
        } else if (
            event === 'unlink' &&
            normalizedPath &&
            this.localModuleContext.has(normalizedPath)
        ) {
            this.localModuleContext.delete(normalizedPath);
        }

        // Step 6: Register decorators with cache update (not for unlink without affected)
        if (affectedFilesWithDecorators.length > 0) {
            this.decoratorsModule.processDecorators(
                {
                    filesWithDecorators: affectedFilesWithDecorators,
                    modules:
                        event === 'coldStart'
                            ? this.localModuleContext
                            : updatedModules,
                },
                params => {
                    this.decoratorRegistry.processEvent('register', params);
                    const filePath = params.sourceFile.getFilePath();
                    if (!this.registeredParams.has(filePath)) {
                        this.registeredParams.set(filePath, []);
                    }
                    this.registeredParams.get(filePath)!.push(params);
                    return true;
                }
            );
        }

        // Step 7: Execute plugin hooks
        await this.pluginManager.executeHook('onAfterDecoratorsProcessed');
        await this.pluginManager.executeHook('onConsumeDependencyContexts');

        const context = GenerationContext.getInstance();
        await this.pluginManager.executeHook('onRegisterMetadata', {
            registerClassMetadata: (...args) =>
                context.registerClassMetadata(...args),
            registerMethodMetadata: (...args) =>
                context.registerMethodMetadata(...args),
        });

        // Step 8: Generate types
        const meta = context.getPreparedData();
        const generatorModule = new GeneratorModule(
            this.config,
            this.scannerModule.getProject()
        );
        const schema = await generatorModule.generate(meta);

        await this.pluginManager.executeHook('onGenerateTypes', schema);

        const duration = (performance.now() - start) / 1000;
        logEventComplete(event, path, duration, meta.length);
    }

    private async updateProject(event: FileEvent, path?: string) {
        const project = this.scannerModule.getProject();
        if (event === 'coldStart') {
            await this.scannerModule.traverseAndCacheTsMorph();
            return;
        }

        if (!path) return;
        const normalizedPath = join(process.cwd(), path);
        let sourceFile = project.getSourceFile(normalizedPath);

        if (event === 'add' || event === 'change') {
            if (!sourceFile) {
                sourceFile = project.addSourceFileAtPath(normalizedPath);
            } else {
                this.scannerModule.restartProject();
            }
        } else if (event === 'unlink') {
            if (sourceFile) {
                project.removeSourceFile(sourceFile);
            }
        }
    }

    private getAffectedFilePaths(event: FileEvent, path?: string): string[] {
        if (event === 'coldStart' || !path) return [];

        const normalizedPath = join(process.cwd(), path);
        const project = this.scannerModule.getProject();
        const sourceFile = project.getSourceFile(normalizedPath);

        if (!sourceFile) {
            return [normalizedPath];
        }

        let referencingPaths: string[] = [];
        try {
            referencingPaths = sourceFile
                .getReferencingSourceFiles()
                .map(sf => sf.getFilePath());
        } catch (error) {
            console.warn(
                `Error getting referencing files for ${normalizedPath}: ${error}`
            );
        }

        const affected = new Set<string>([normalizedPath, ...referencingPaths]);
        return Array.from(affected);
    }

    private getAffectedFilesWithDecorators(
        event: FileEvent,
        path?: string
    ): Array<{ sourceFile: SourceFile; type: DecoratorType }> {
        const registeredDecorators =
            this.decoratorRegistry.getRegisteredDecorators();

        if (event === 'coldStart') {
            return this.scannerModule.getSourceFilesWithDecorators(
                registeredDecorators
            );
        }

        if (!path) return [];

        const normalizedPath = join(process.cwd(), path);
        const project = this.scannerModule.getProject();
        let baseFiles: SourceFile[] = [];

        const sourceFile = project.getSourceFile(normalizedPath);
        if (sourceFile && event !== 'unlink') {
            baseFiles = [sourceFile];
        }

        let referencingFiles: SourceFile[] = [];
        if (sourceFile) {
            try {
                referencingFiles = sourceFile.getReferencingSourceFiles();
            } catch (error) {
                console.warn(
                    `Error getting referencing files for ${normalizedPath}: ${error}`
                );
            }
        }

        const allAffected = [...baseFiles, ...referencingFiles];

        return allAffected
            .map(sf => {
                try {
                    const { type } = this.scannerModule.getFileTypeOfSourceFile(
                        sf,
                        registeredDecorators
                    );
                    return type ? { sourceFile: sf, type } : null;
                } catch (error) {
                    console.warn(
                        `Error accessing source file ${sf.getFilePath()}: ${error}`
                    );
                    return null;
                }
            })
            .filter(
                (
                    value
                ): value is { sourceFile: SourceFile; type: DecoratorType } =>
                    value !== null
            );
    }

    private filterRuntimeFiles(
        filesWithDecorators: Array<{
            sourceFile: SourceFile;
            type: DecoratorType;
        }>
    ): SourceFile[] {
        return filesWithDecorators
            .filter(({ type }) => type === 'run-time')
            .map(({ sourceFile }) => sourceFile);
    }
}
