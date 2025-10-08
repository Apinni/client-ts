import type { Decorator, SourceFile } from 'ts-morph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DecoratorsModule } from './decorators';

describe('DecoratorsModule', () => {
    let processor: DecoratorsModule;
    let mockDecorator: Decorator;
    let onProcess: ReturnType<typeof vi.fn>;
    let mockFile: SourceFile;

    beforeEach(() => {
        processor = new DecoratorsModule();
        mockDecorator = { getName: vi.fn().mockReturnValue('Dec') } as any;
        onProcess = vi.fn().mockReturnValue(true);

        mockFile = {
            getFilePath: vi.fn().mockReturnValue('/fake/file.ts'),
            getClasses: vi.fn().mockReturnValue([]),
        } as unknown as SourceFile;
    });

    it('processes class decorators', async () => {
        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([mockDecorator]),
            getMethods: vi.fn().mockReturnValue([]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const mockModule = { MyClass: class {} };

        const modules = new Map([[mockFile.getFilePath(), mockModule]]);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: mockModule.MyClass,
            decorator: mockDecorator,
            sourceFile: mockFile,
        });
    });

    it('processes method decorators (instance method)', async () => {
        const methodDec = { getName: vi.fn().mockReturnValue('Dec') } as any;

        const mockMethod = {
            getName: vi.fn().mockReturnValue('foo'),
            isStatic: vi.fn().mockReturnValue(false),
            getDecorators: vi.fn().mockReturnValue([methodDec]),
        };

        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([]),
            getMethods: vi.fn().mockReturnValue([mockMethod]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        class MyClass {
            foo() {}
        }

        const modules = new Map([[mockFile.getFilePath(), { MyClass }]]);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: MyClass,
            propertyKey: 'foo',
            decorator: methodDec,
            sourceFile: mockFile,
        });
    });

    it('processes method decorators (static method)', async () => {
        const methodDec = { getName: vi.fn().mockReturnValue('Dec') } as any;

        const mockMethod = {
            getName: vi.fn().mockReturnValue('bar'),
            isStatic: vi.fn().mockReturnValue(true),
            getDecorators: vi.fn().mockReturnValue([methodDec]),
        };

        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([]),
            getMethods: vi.fn().mockReturnValue([mockMethod]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        class MyClass {
            static bar() {}
        }

        const modules = new Map([[mockFile.getFilePath(), { MyClass }]]);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: MyClass,
            propertyKey: 'bar',
            decorator: methodDec,
            sourceFile: mockFile,
        });
    });

    it('processes decorators (compile-time)', async () => {
        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([mockDecorator]),
            getMethods: vi.fn().mockReturnValue([]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const modules = new Map();

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'compile-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: `${mockFile.getFilePath()}_MyClass`,
            decorator: mockDecorator,
            sourceFile: mockFile,
        });
    });

    it('processes method decorators (compile-time)', async () => {
        const methodDec = { getName: vi.fn().mockReturnValue('Dec') } as any;

        const mockMethod = {
            getName: vi.fn().mockReturnValue('bar'),
            isStatic: vi.fn().mockReturnValue(true),
            getDecorators: vi.fn().mockReturnValue([methodDec]),
        };

        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([]),
            getMethods: vi.fn().mockReturnValue([mockMethod]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const modules = new Map();

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'compile-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: `${mockFile.getFilePath()}_MyClass`,
            propertyKey: 'bar',
            decorator: methodDec,
            sourceFile: mockFile,
        });
    });

    it('falls back to default export when class name not found', async () => {
        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MissingClass'),
            getDecorators: vi.fn().mockReturnValue([mockDecorator]),
            getMethods: vi.fn().mockReturnValue([]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const DefaultExport = class {};
        const modules = new Map([
            [mockFile.getFilePath(), { default: DefaultExport }],
        ]);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(1);
        expect(onProcess).toHaveBeenCalledWith({
            target: DefaultExport,
            decorator: mockDecorator,
            sourceFile: mockFile,
        });
    });

    it('skips if no module export is found for class', async () => {
        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('UnknownClass'),
            getDecorators: vi.fn().mockReturnValue([]),
            getMethods: vi.fn().mockReturnValue([]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const modules = new Map([[mockFile.getFilePath(), {}]]);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcess
        );

        expect(count).toBe(0);
        expect(onProcess).not.toHaveBeenCalled();
    });

    it('counts only processed decorators (onProcess returns false)', async () => {
        const mockClassDecl = {
            getName: vi.fn().mockReturnValue('MyClass'),
            getDecorators: vi.fn().mockReturnValue([mockDecorator]),
            getMethods: vi.fn().mockReturnValue([]),
        };

        mockFile.getClasses = vi.fn().mockReturnValue([mockClassDecl]);

        const mockModule = { MyClass: class {} };

        const modules = new Map([[mockFile.getFilePath(), mockModule]]);

        const onProcessFalse = vi.fn().mockReturnValue(false);

        const count = await processor.processDecorators(
            {
                filesWithDecorators: [
                    { sourceFile: mockFile, type: 'run-time' },
                ],
                modules,
            },
            onProcessFalse
        );

        expect(count).toBe(0);
        expect(onProcessFalse).toHaveBeenCalled();
    });
});
