import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { getTypeAndNode, SchemaBuilderModule } from './schema-builder'; // Assume the module is exported from this file

describe('SchemaBuilderModule', () => {
    const createProject = () => {
        return new Project({
            useInMemoryFileSystem: true,
            compilerOptions: {
                lib: ['lib.es2024.d.ts'],
                strictNullChecks: true,
            },
        });
    };

    const getSchema = (builder: SchemaBuilderModule, entries: any[]) => {
        return builder.generateSchema(entries);
    };

    describe('Primitive and Literal Types', () => {
        it('handles any type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = any;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({});
            expect(result.refs).toEqual({});
        });

        it('handles unknown type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = unknown;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({});
            expect(result.refs).toEqual({});
        });

        it('handles never type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = never;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ not: {} });
            expect(result.refs).toEqual({});
        });

        it('handles null type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = null;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'null' });
            expect(result.refs).toEqual({});
        });

        it('handles string type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = string;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'string' });
            expect(result.refs).toEqual({});
        });

        it('handles template literal type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = `hello ${string}`;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'string' });
            expect(result.refs).toEqual({});
        });

        it('handles number type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = number;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'number' });
            expect(result.refs).toEqual({});
        });

        it('handles boolean type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = boolean;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'boolean' });
            expect(result.refs).toEqual({});
        });

        it('handles string literal', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = "hello";'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'string',
                const: 'hello',
            });
            expect(result.refs).toEqual({});
        });

        it('handles number literal', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = 42;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'number', const: 42 });
            expect(result.refs).toEqual({});
        });

        it('handles boolean literal true', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = true;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'boolean',
                const: true,
            });
            expect(result.refs).toEqual({});
        });

        it('handles boolean literal false', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = false;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'boolean',
                const: false,
            });
            expect(result.refs).toEqual({});
        });
    });

    describe('Enum and Special Types', () => {
        it('handles enum type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        enum TestEnum { A = 'a', B = 'b' }
        type Example = TestEnum;
      `
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'TestEnum',
            });
            expect(result.refs.TestEnum).toEqual({
                type: 'enum',
                values: ['a', 'b'],
            });
        });

        it('handles Date type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = Date;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'string' });
            expect(result.refs).toEqual({});
        });

        it('handles Promise type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = Promise<string>;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'string' });
            expect(result.refs).toEqual({});
        });
    });

    describe('Array and Tuple Types', () => {
        it('handles array type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = string[];'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'array',
                items: { type: 'string' },
            });
            expect(result.refs).toEqual({});
        });

        it('handles tuple type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = [string, number];'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'array',
                items: [{ type: 'string' }, { type: 'number' }],
            });
        });
    });

    describe('Union Types', () => {
        it('handles simple union type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = string | number;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                anyOf: [{ type: 'string' }, { type: 'number' }],
            });
        });

        it('handles union of literals as enum', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = "a" | "b" | 1 | 2;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'enum',
                values: ['a', 'b', 1, 2],
            });
        });

        it('handles union of booleans as boolean', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = true | false;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({ type: 'boolean' });
        });

        it('handles single union type as the type itself', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = string | undefined;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({ type: 'string' });
        });
    });

    describe('Intersection Types', () => {
        it('handles intersection type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        type A = { a: string };
        type B = { b: number };
        type Example = A & B;
      `
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs).toEqual({
                Example: {
                    allOf: [
                        {
                            type: 'ref',
                            name: 'A',
                        },
                        {
                            type: 'ref',
                            name: 'B',
                        },
                    ],
                },
                A: {
                    type: 'object',
                    properties: { a: { type: 'string' } },
                    required: ['a'],
                },
                B: {
                    type: 'object',
                    properties: { b: { type: 'number' } },
                    required: ['b'],
                },
            });
        });
    });

    describe('Object Types', () => {
        it('handles simple object type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = { a: string; b: number };'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' }, b: { type: 'number' } },
                required: ['a', 'b'],
            });
        });

        it('handles object with optional properties', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = { a: string; b?: number };'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' }, b: { type: 'number' } },
                required: ['a'],
            });
        });

        it('handles object with index signature', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = { [key: string]: number };'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: {},
                indexedProperties: { type: 'number' },
            });
        });

        it('handles mapped type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        type Keys = 'a' | 'b';
        type Example = { [K in Keys]: string };
      `
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' }, b: { type: 'string' } },
                required: ['a', 'b'],
            });
        });
    });

    describe('References and Complex Structures', () => {
        it('handles referenced types', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        type Bar = string;
        type Example = { foo: Bar };
      `
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { foo: { type: 'string' } },
                required: ['foo'],
            });
        });

        it('handles generic types', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        type Foo<T> = { val: T };
        type Example = Foo<string>;
      `
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'object',
                properties: { val: { type: 'string' } },
                required: ['val'],
            });
            expect(result.refs).toEqual({});
        });

        it('handles name conflicts between schema and refs', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                `
        type Bar = string;
        type Foo = { val: Bar };
      `
            );
            const dataFoo = getTypeAndNode(sourceFile, 'Foo');
            const dataBar = getTypeAndNode(sourceFile, 'Bar');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Bar', type: dataBar!.type, node: dataBar!.node },
                { name: 'Foo', type: dataFoo!.type, node: dataFoo!.node },
            ]);
            expect(result.schema.Foo_1).toEqual({
                type: 'ref',
                name: 'Foo',
            });
            expect(result.schema.Bar).toEqual({ type: 'string' }); // Renamed due to conflict
            expect(result.refs).toEqual({
                Foo: {
                    type: 'object',
                    properties: { val: { type: 'string' } },
                    required: ['val'],
                },
            });
        });
    });

    describe('Model Entries with Collected Types', () => {
        it('handles model entry with collected types', () => {
            const project = createProject();
            const builder = new SchemaBuilderModule(project);
            builder.storeCollectedTypes(`
        type Example = { a: string };
      `);
            const result = getSchema(builder, [
                { name: 'Test', model: 'Example' },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
            });
        });

        it('handles mixed entries: type/node and model', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Foo = string;'
            );
            const data = getTypeAndNode(sourceFile, 'Foo');
            const builder = new SchemaBuilderModule(project);
            builder.storeCollectedTypes(`
        type Bar = number;
      `);
            const result = getSchema(builder, [
                { name: 'Foo', type: data!.type, node: data!.node },
                { name: 'Bar', model: 'Bar' },
            ]);
            expect(result.schema.Foo).toEqual({ type: 'string' });
            expect(result.schema.Bar).toEqual({ type: 'number' });
            expect(result.refs).toEqual({});
        });
    });

    describe('Interface and Class Types', () => {
        it('handles interface', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'interface Example { a: string; }'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
            });
        });

        it('handles class', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'class Example { a: string = "hello"; }'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Example',
            });
            expect(result.refs.Example).toEqual({
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
            });
        });
    });

    describe('Variable Declaration Types', () => {
        it('handles variable declaration with type', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'const test: { a: string } = { a: "hello" };'
            );
            const data = getTypeAndNode(sourceFile, 'typeof test');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
            });
            expect(result.refs).toEqual({});
        });
    });

    describe('Edge Cases', () => {
        it('handles inline type alias', () => {
            const project = createProject();
            const sourceFile = project.createSourceFile(
                'test.ts',
                'type Example = string;'
            );
            const data = getTypeAndNode(sourceFile, 'Example');
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, [
                { name: 'Test', type: data!.type, node: data!.node },
            ]);
            expect(result.schema.Test).toEqual({ type: 'string' });
            expect(result.refs).toEqual({});
        });

        it('handles no entries', () => {
            const project = createProject();
            const builder = new SchemaBuilderModule(project);
            const result = getSchema(builder, []);
            expect(result.schema).toEqual({});
            expect(result.refs).toEqual({});
            expect(result.mappedReferences).toEqual({});
        });

        it('handles invalid model', () => {
            const project = createProject();
            const builder = new SchemaBuilderModule(project);
            builder.storeCollectedTypes('');
            const result = getSchema(builder, [
                { name: 'Test', model: 'Invalid' },
            ]);
            expect(result.schema.Test).toEqual({
                type: 'ref',
                name: 'Invalid',
            });
            expect(result.refs.Invalid).toEqual({});
        });
    });
});
