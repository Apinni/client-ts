import { Project } from 'ts-morph';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScannerModule } from './scanner';

describe('ScannerModule', () => {
    let project: Project;
    let scanner: ScannerModule;

    beforeEach(() => {
        project = new Project({ useInMemoryFileSystem: true });
        scanner = new ScannerModule({ project });
    });

    it('detects classes with internal decorators', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            @ApinniController()
            class TestClass {}
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ApinniController', type: 'compile-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('detects classes with external decorators', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            @ExternalDecorator()
            class TestClass {}
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ExternalDecorator', type: 'run-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('detects classes with decorators and named imports', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            import { ExternalDecorator as ExtraDecorator } from './somewhere';
            import { ExtraDecorator as ExternalDecorator } from './somewhere';

            @ExtraDecorator()
            class TestClass {}
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ExternalDecorator', type: 'run-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('detects classes with decorators and namespaced imports', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            import * as Decorators from './somewhere';

            @Decorators.ExternalDecorator()
            class TestClass {}
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ExternalDecorator', type: 'run-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('detects method decorators (internal)', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            class TestClass {
                @ApinniEndpoint()
                myMethod() {}
            }
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators()
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('detects method decorators (external)', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            class TestClass {
                @ExternalDecorator
                myMethod() {}
            }
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ExternalDecorator', type: 'run-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });

    it('returns empty array when no listed decorators are present', () => {
        project.createSourceFile(
            '/file.ts',
            `
            class TestClass {
                @RandomDecorator()
                myMethod() {}
            }
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators()
            .map(({ sourceFile }) => sourceFile);
        expect(result).toEqual([]);
    });

    it('only includes files with at least one matching decorator', () => {
        const fileWith = project.createSourceFile(
            '/with.ts',
            `
            @ApinniDomain()
            class Decorated {}
        `
        );
        project.createSourceFile(
            '/without.ts',
            `
            class Plain {}
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators()
            .map(({ sourceFile }) => sourceFile);
        expect(result).toEqual([fileWith]);
    });

    it('handles multiple decorators in the same file', () => {
        const file = project.createSourceFile(
            '/file.ts',
            `
            @ApinniController()
            class A {}

            class B {
                @ExternalDecorator
                method() {}
            }
        `
        );

        const result = scanner
            .getSourceFilesWithDecorators([
                { name: 'ExternalDecorator', type: 'run-time' },
            ])
            .map(({ sourceFile }) => sourceFile);
        expect(result).toContain(file);
    });
});
