import { constants } from 'fs';
import fs from 'fs/promises';
import { SourceFile } from 'ts-morph';

const getOutputFilePath = (file: SourceFile): string | null => {
    const result = file.getEmitOutput({ emitOnlyDtsFiles: false });

    for (const outputFile of result.getOutputFiles()) {
        const filePath = outputFile.getFilePath();
        if (filePath.endsWith('.js')) {
            return filePath;
        }
    }

    return null;
};

export class ImporterModule {
    constructor() {}

    public async import(
        files: Array<SourceFile>,
        alwaysFresh: boolean = false
    ): Promise<Map<string, any>> {
        const modules = new Map<string, any>();

        const importPromises = Array.from(files).map(async file => {
            const filePath = file.getFilePath();
            try {
                const module = await this.importFile(file, alwaysFresh);
                if (module) {
                    modules.set(filePath, module);
                }
            } catch (error) {
                console.error(
                    `Unable to load file at path: ${filePath}`,
                    error
                );
            }
        });

        await Promise.all(importPromises);

        return modules;
    }

    private async importFile(
        file: SourceFile,
        alwaysFresh: boolean = false
    ): Promise<any | null> {
        const outputPath = getOutputFilePath(file);

        if (!outputPath) {
            return null;
        }

        await fs.access(outputPath, constants.R_OK);

        if (alwaysFresh) {
            delete require.cache[outputPath];
        }

        const importPath = `${outputPath}${alwaysFresh ? `?v=${Date.now()}` : ''}`;

        if (!importPath.startsWith(process.cwd())) {
            throw new Error('Invalid path');
        }

        const module = await import(importPath);
        return module.default || module;
    }
}
