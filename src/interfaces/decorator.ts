import { Decorator } from 'ts-morph';

export type DecoratorVariant = 'class' | 'method';

export type DecoratorType = 'compile-time' | 'run-time';

export type HandlerEvent = 'register' | 'unregister';

export interface DecoratorDefinition<
    T extends DecoratorVariant = DecoratorVariant,
> {
    name: string;
    variant: T;
    type: DecoratorType;
    handler: (
        event: HandlerEvent,
        params: {
            target: any;
            decorator: Decorator;
        } & (T extends 'method'
            ? { propertyKey: string | symbol }
            : Record<never, never>)
    ) => void;
}
