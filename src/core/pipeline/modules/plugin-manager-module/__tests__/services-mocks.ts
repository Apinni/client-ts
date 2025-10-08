import {
    ClassMetadata,
    DecoratorDefinition,
    DecoratorVariant,
    MethodMetadata,
} from '@interfaces';
import { ShareableContext, ShareableRegistry } from '@interfaces/shared';

type Listener = (
    event: 'register' | 'unregister',
    params: { target: any }
) => void;

export class MockRegistry implements ShareableRegistry {
    decorators: Map<string, Listener[]> = new Map();

    constructor() {}

    register: <T extends DecoratorVariant>(
        definition: DecoratorDefinition<T>
    ) => void = definition => {
        const listeners = this.decorators.get(definition.name) ?? [];
        this.decorators.set(definition.name, [
            ...listeners,
            definition.handler as Listener,
        ]);
    };

    trigger(event: 'register' | 'unregister', name: string, target: any) {
        const handlers = this.decorators.get(name);

        if (handlers) {
            handlers.forEach(handler =>
                handler(event, {
                    target,
                })
            );
        }
    }
}

export class MockContext implements ShareableContext {
    classes = [] as Array<ClassMetadata>;
    methods = [] as Array<MethodMetadata>;

    constructor() {}

    registerClassMetadata(
        target: any,
        metadata: Partial<Omit<ClassMetadata, 'target'>>
    ): void {
        const existing = this.classes.find(cl => cl.target === target);
        if (existing) {
            this.classes.splice(this.classes.indexOf(existing), 1, {
                ...existing,
                ...metadata,
            });
            return;
        }

        this.classes.push({
            target,
            ...metadata,
        });
    }

    registerMethodMetadata(
        target: any,
        propertyKey: string | symbol,
        metadata: Partial<MethodMetadata>
    ): void {
        const existing = this.methods.find(
            method =>
                method.target === target && method.propertyKey === propertyKey
        );

        if (existing) {
            this.methods.splice(this.methods.indexOf(existing), 1, {
                ...existing,
                ...metadata,
            });
            return;
        }

        this.methods.push({
            target,
            ...metadata,
        } as MethodMetadata);
    }
}
