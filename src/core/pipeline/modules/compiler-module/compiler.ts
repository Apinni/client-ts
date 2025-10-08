import fs from 'fs/promises';
import { join } from 'path';
import {
    ModuleKind,
    ModuleResolutionKind,
    Project,
    SourceFile,
} from 'ts-morph';

import { CACHE_PATH } from '../../../constants/cache';
import { getFileHash } from './utils';

export class CompilerModule {
    private project: Project;

    constructor(project?: Project) {
        this.project =
            project ??
            new Project({
                tsConfigFilePath: join(process.cwd(), 'tsconfig.json'),
                skipAddingFilesFromTsConfig: true,
                skipFileDependencyResolution: true,
                compilerOptions: {
                    module: ModuleKind.CommonJS,
                    moduleResolution: ModuleResolutionKind.Node16,
                    outDir: './.apinni/build',
                },
            });
    }

    /**
     * Recursively collect all referenced files starting from entry files, skipping .d.ts.
     * @param entryFiles Initial files to start collection from.
     * @returns Map of file paths to SourceFile objects.
     */
    public getReferencedFiles(entryFiles: SourceFile[]): SourceFile[] {
        const referencedFiles = new Map<string, SourceFile>();
        const queue = [...entryFiles];

        while (queue.length > 0) {
            const file = queue.pop()!;
            const filePath = file.getFilePath();

            if (referencedFiles.has(filePath) || filePath.endsWith('.d.ts')) {
                continue;
            }

            referencedFiles.set(filePath, file);

            const newFiles = file.getReferencedSourceFiles();

            queue.push(
                ...newFiles.filter(refFile => {
                    const refPath = refFile.getFilePath();
                    return !(
                        referencedFiles.has(refPath) ||
                        refPath.endsWith('.d.ts')
                    );
                })
            );
        }

        return Array.from(referencedFiles.values());
    }

    /**
     * Compile the provided files, optionally including referenced files and respecting cache.
     * Only changed files (based on content hash) are compiled unless force is true.
     * @param entryFiles Files to compile (or start referencing from).
     * @param compileOptions Additional options.
     */
    public async compileFiles(
        entryFiles: SourceFile[],
        compileOptions: {
            /** Force compilation of all files, ignoring cache */
            force?: boolean;
            /** Include and compile referenced files recursively */
            includeReferenced?: boolean;
        } = {}
    ): Promise<number> {
        const { force = false, includeReferenced = true } = compileOptions;

        const filesToProcess = includeReferenced
            ? this.getReferencedFiles(entryFiles)
            : entryFiles;

        const cache = await this.loadCache();
        const filesToCompile = force
            ? filesToProcess
            : this.extractChangedFiles(filesToProcess, cache);

        if (filesToCompile.length === 0) {
            return 0;
        }

        // Add files to project (use createSourceFile to copy content, as in original)
        const addedFiles = filesToCompile.map(file =>
            this.project.createSourceFile(
                file.getFilePath(),
                file.getFullText(),
                { overwrite: true }
            )
        );

        await Promise.all(this.project.getSourceFiles().map(sf => sf.emit()));

        const compiledFiles = filesToCompile.length;

        // Update cache with new hashes
        filesToCompile.forEach(file => {
            const filePath = file.getFilePath();
            cache[filePath] = getFileHash(file.getFullText());
        });

        // Clean up
        addedFiles.forEach(file => this.project.removeSourceFile(file));

        await this.saveCache(cache);

        return compiledFiles;
    }

    /**
     * Load the cache from file.
     */
    private async loadCache(): Promise<Record<string, string>> {
        try {
            const cacheContent = await fs.readFile(
                join(process.cwd(), CACHE_PATH),
                'utf-8'
            );
            return JSON.parse(cacheContent);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                return {};
            }
            throw err;
        }
    }

    /**
     * Save the cache to file.
     */
    private async saveCache(cache: Record<string, string>): Promise<void> {
        await fs.writeFile(
            join(process.cwd(), CACHE_PATH),
            JSON.stringify(cache, null, 2),
            'utf8'
        );
    }

    /**
     * Filter files that have changed based on cache hashes.
     * Updates cache in-place for new/changed files.
     */
    private extractChangedFiles(
        files: SourceFile[],
        cache: Record<string, string>
    ): SourceFile[] {
        return files.filter(file => {
            const filePath = file.getFilePath();
            const currentHash = getFileHash(file.getFullText());

            return cache[filePath] !== currentHash;
        });
    }
}
