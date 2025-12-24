import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { TypesLookupModule } from './types-lookup';

describe('TypesLookupModule', () => {
    it('should correctly extract names', () => {
        const project = new Project({
            useInMemoryFileSystem: true,
        });

        project.createSourceFile(
            'types.ts',
            `
interface User extends Entity {
    name: string;
    age: number;
};

enum Category {
    ValueOne = 'value-one',
    ValueTwo = 2,
    ValueThree = 'value-three',
};

type SomeType = {
  value: number;
  c: Category;
}

type Entity = SomeType & {
    id: string;
    _v?: number;
};

type Paginated<T extends number> = {
    items: T[];
    total: number;
}
`
        );

        const typesLookup = new TypesLookupModule(project);
        typesLookup.buildTypeIndexes();

        const types = [
            'User',
            'Record<string, Category>',
            'Paginated<Entity>',
            'Partial<User>',
        ];

        const names = typesLookup.lookup(types);

        expect(names.length).toBe(5);
        expect(names[0]).toEqual(
            expect.stringContaining('name: string') &&
                expect.stringContaining('age: number')
        );
        expect(names[1]).toEqual(
            expect.stringContaining("ValueOne = 'value-one'") &&
                expect.stringContaining('ValueTwo = 2') &&
                expect.stringContaining("ValueThree = 'value-three'")
        );
        expect(names[2]).toEqual(
            expect.stringContaining('items: T[]') &&
                expect.stringContaining('total: number')
        );
        expect(names[3]).toEqual(
            expect.stringContaining('id: string') &&
                expect.stringContaining('_v?: number')
        );
    });
    it('should resolve duplicates', () => {
        const project = new Project({
            useInMemoryFileSystem: true,
        });

        //         project.createSourceFile(
        //             'common.ts',
        //             `
        // export interface Entity {
        //     id: string;
        //     name: string;
        // }
        // `
        //         );
        project.createSourceFile(
            'domain.ts',
            `
export interface Entity {
    id: string;
    source: string
}
`
        );
        project.createSourceFile(
            'user.ts',
            `
import { Entity } from './domain';

export interface Entity {
    name: string;
}

export type GetUserResponse = Entity
`
        );

        const typesLookup = new TypesLookupModule(project);
        typesLookup.buildTypeIndexes();

        const type = typesLookup.lookupNode([
            { model: 'GetUserResponse', name: '' },
        ])[0];
        console.log(
            'type' in type
                ? [
                      type.type.getSymbol()?.getName(),
                      type.node.getSymbol()?.getName(),
                  ]
                : []
        );
    });
});
