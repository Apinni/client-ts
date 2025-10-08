import { join } from 'path';
import type { SourceFile } from 'ts-morph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImporterModule } from './importer';

// --- Mock fs.promises.access ---
vi.mock('fs/promises', () => ({
    default: {
        access: vi.fn(),
    },
}));

let fileName = 'file.js';

const resolvePath = () =>
    join(
        process.cwd(),
        `src/core/pipeline/modules/importer-module/mocks/${fileName}`
    );

describe('ImporterModule', () => {
    let mockFs: {
        access: ReturnType<typeof vi.fn>;
    };
    let mockSourceFile: SourceFile;

    beforeEach(async () => {
        mockFs = (await import('fs/promises')).default as any;
        mockFs.access.mockReset();

        mockSourceFile = {
            getFilePath: vi.fn().mockReturnValue('/fake/file.ts'),
            getEmitOutput: vi.fn().mockReturnValue({
                getOutputFiles: vi.fn().mockReturnValue([
                    {
                        getFilePath: () => {
                            return resolvePath();
                        },
                    },
                ]),
            }),
        } as unknown as SourceFile;
    });

    it('loads a module successfully (with default export)', async () => {
        mockFs.access.mockResolvedValue(undefined);

        fileName = 'default.js';

        const loader = new ImporterModule();
        const result = await loader.import([mockSourceFile]);

        expect(result.get('/fake/file.ts')).toEqual({ foo: 42 });
    });

    it('loads a module successfully (no default export)', async () => {
        mockFs.access.mockResolvedValue(undefined);

        fileName = 'file.js';

        const loader = new ImporterModule();
        const result = await loader.import([mockSourceFile]);

        expect(result.get('/fake/file.ts')['foo']).toEqual(42);
    });

    it('returns empty map if no .js output file exists', async () => {
        mockSourceFile.getEmitOutput = vi.fn().mockReturnValue({
            getOutputFiles: vi
                .fn()
                .mockReturnValue([{ getFilePath: () => '/fake/file.d.ts' }]),
        });

        const loader = new ImporterModule();
        const result = await loader.import([mockSourceFile]);

        expect(result.size).toBe(0);
    });

    it('skips module if fs.access fails', async () => {
        mockFs.access.mockRejectedValue(new Error('no access'));

        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const loader = new ImporterModule();
        const result = await loader.import([mockSourceFile]);

        expect(result.size).toBe(0);
        expect(consoleSpy).toBeCalled();
    });

    it('logs error and continues if import fails', async () => {
        mockFs.access.mockRejectedValue(new Error());

        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const loader = new ImporterModule();
        const result = await loader.import([mockSourceFile]);

        expect(result.size).toBe(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Unable to load file at path: /fake/file.ts'
            ),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });
});
