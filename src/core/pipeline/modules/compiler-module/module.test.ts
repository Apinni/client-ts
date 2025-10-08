import { Project } from 'ts-morph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CACHE_PATH } from '../../../constants/cache';
import { CompilerModule } from './compiler';
import { getFileHash } from './utils';

// Mock fs.promises globally
vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
    },
}));

describe('CompilerModule', () => {
    let mockFs: {
        readFile: ReturnType<typeof vi.fn>;
        writeFile: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockFs = (await import('fs/promises')).default as any;
        mockFs.readFile.mockReset();
        mockFs.writeFile.mockReset();
    });

    it('compiles and writes cache', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/file.ts', "console.log('hi');");

        const compiler = new CompilerModule(project);

        mockFs.readFile.mockResolvedValueOnce('{}');
        mockFs.writeFile.mockResolvedValue(undefined);

        const emitSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });

        await compiler.compileFiles([file]);

        expect(emitSpy).toHaveBeenCalled();
        expect(mockFs.writeFile).toHaveBeenCalledWith(
            expect.stringContaining(CACHE_PATH),
            expect.stringContaining(getFileHash("console.log('hi');")),
            'utf8'
        );
    });

    it('skips unchanged files based on cache', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile(
            '/file.ts',
            "console.log('same');"
        );

        const hash = getFileHash("console.log('same');");
        mockFs.readFile.mockResolvedValueOnce(
            JSON.stringify({ '/file.ts': hash })
        );
        mockFs.writeFile.mockResolvedValue(undefined);

        const compiler = new CompilerModule(project);

        const emitSpy = vi.spyOn(project, 'emit');

        await compiler.compileFiles([file]);

        expect(emitSpy).not.toHaveBeenCalled();
        expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('recompiles changed files', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile(
            '/file.ts',
            "console.log('new content');"
        );

        mockFs.readFile.mockResolvedValueOnce(
            JSON.stringify({ '/file.ts': 'oldhash' })
        );
        mockFs.writeFile.mockResolvedValue(undefined);

        const compiler = new CompilerModule(project);
        const emitSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });

        await compiler.compileFiles([file]);

        expect(emitSpy).toHaveBeenCalled();
        expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('resolves referenced files if includeReferenced = true', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/ref.ts', 'export const r = 1;');
        const entryFile = project.createSourceFile(
            '/entry.ts',
            "import './ref';",
            { overwrite: true }
        );

        const compiler = new CompilerModule(project);

        mockFs.readFile.mockResolvedValueOnce('{}');
        mockFs.writeFile.mockResolvedValue(undefined);

        const emitFileSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });
        const emitEntryFileSpy = vi.spyOn(entryFile, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });

        await compiler.compileFiles([entryFile], { includeReferenced: true });

        expect(emitFileSpy).toHaveBeenCalled();
        expect(emitEntryFileSpy).toHaveBeenCalled();

        const calls = mockFs.writeFile.mock.calls.map(c => c[1]);
        const allCache = calls.join();
        expect(allCache).toContain(getFileHash("import './ref';"));
        expect(allCache).toContain(getFileHash('export const r = 1;'));
    });

    it('does not include referenced files if includeReferenced = false', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/ref.ts', 'export const r = 1;');
        const entryFile = project.createSourceFile(
            '/entry.ts',
            "import { r } from './ref'; console.log(r);"
        );

        const compiler = new CompilerModule(project);

        mockFs.readFile.mockResolvedValueOnce('{}');
        mockFs.writeFile.mockResolvedValue(undefined);

        const emitFileSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });
        const emitEntryFileSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });

        await compiler.compileFiles([entryFile], { includeReferenced: false });

        expect(emitEntryFileSpy).toHaveBeenCalled();
        expect(emitFileSpy).not.toHaveBeenCalled();

        const calls = mockFs.writeFile.mock.calls.map(c => c[1]);
        const allCache = calls.join();
        expect(allCache).toContain(
            getFileHash("import { r } from './ref'; console.log(r);")
        );
        expect(allCache).not.toContain(getFileHash('export const r = 1;'));
    });

    it('handles missing cache file gracefully (ENOENT)', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/file.ts', 'console.log()');

        mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
        mockFs.writeFile.mockResolvedValue(undefined);

        const compiler = new CompilerModule(project);

        const emitSpy = vi.spyOn(file, 'emit').mockResolvedValue({
            getEmitSkipped: () => false,
            getDiagnostics: () => [],
            compilerObject: { emitSkipped: false, diagnostics: [] },
        });

        await expect(compiler.compileFiles([file])).resolves.not.toThrow();
        expect(emitSpy).toHaveBeenCalled();
        expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('throws if fs.readFile fails with non-ENOENT', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/file.ts', 'console.log()');

        mockFs.readFile.mockRejectedValueOnce({ code: 'EACCES' });

        const compiler = new CompilerModule(project);

        await expect(compiler.compileFiles([file])).rejects.toEqual({
            code: 'EACCES',
        });
    });

    it('throws if project.emit fails', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = project.createSourceFile('/file.ts', 'console.log()');

        mockFs.readFile.mockResolvedValueOnce('{}');
        mockFs.writeFile.mockResolvedValue(undefined);

        const compiler = new CompilerModule(project);
        vi.spyOn(file, 'emit').mockRejectedValueOnce(new Error('Emit failed'));

        await expect(compiler.compileFiles([file])).rejects.toThrow(
            'Emit failed'
        );
    });
});
