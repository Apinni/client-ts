import { ClassMetadata, MethodMetadata } from './context';
import { DecoratorDefinition, DecoratorVariant } from './decorator';

export interface ShareableRegistry {
    register: <T extends DecoratorVariant>(
        definition: DecoratorDefinition<T>
    ) => void;
}

export interface ShareableContext<
    ClassMeta extends Record<string, any> = Record<string, any>,
    MethodMeta extends Record<string, any> = Record<string, any>,
> {
    registerClassMetadata(
        target: any,
        metadata: Partial<Omit<ClassMetadata, 'target'> & ClassMeta>
    ): void;
    registerMethodMetadata(
        target: any,
        propertyKey: string | symbol,
        metadata: Partial<MethodMetadata & MethodMeta>
    ): void;
}
