import { Decorator } from 'ts-morph';

import {
    DecoratorDefinition,
    DecoratorVariant,
    HandlerEvent,
} from '@interfaces';
import { ShareableRegistry } from '@interfaces/shared';

import {
    ApinniControllerHandler,
    ApinniDisabledClassHandler,
    ApinniDisabledMethodHandler,
    ApinniDomainHandler,
    ApinniEndpointHandler,
} from './internal-handlers';

export class DecoratorRegistry implements ShareableRegistry {
    private decorators: Map<string, DecoratorDefinition[]> = new Map();

    constructor() {
        this.register({
            name: 'ApinniController',
            variant: 'class',
            type: 'compile-time',
            handler: ApinniControllerHandler,
        });

        this.register({
            name: 'ApinniDomain',
            variant: 'class',
            type: 'compile-time',
            handler: ApinniDomainHandler,
        });

        this.register({
            name: 'ApinniDisabled',
            variant: 'class',
            type: 'compile-time',
            handler: ApinniDisabledClassHandler,
        });

        this.register({
            name: 'ApinniDisabled',
            variant: 'method',
            type: 'compile-time',
            handler: ApinniDisabledMethodHandler,
        });

        this.register({
            name: 'ApinniEndpoint',
            variant: 'method',
            type: 'compile-time',
            handler: ApinniEndpointHandler,
        });
    }

    register<T extends DecoratorVariant>(
        definition: DecoratorDefinition<T>
    ): void {
        const key = `${definition.name}:${definition.variant}`;
        const definitions = this.decorators.get(key) ?? [];
        this.decorators.set(key, [...definitions, definition]);
    }

    getRegisteredDecorators() {
        return Array.from(this.decorators.values()).map(([handler]) => ({
            name: handler.name,
            type: handler.type,
        }));
    }

    processEvent(
        event: HandlerEvent,
        {
            target,
            decorator,
            propertyKey,
        }: {
            target: any;
            decorator: Decorator;
            propertyKey?: string | symbol;
        }
    ): boolean {
        const name = decorator.getName();
        const variant = propertyKey ? 'method' : 'class';
        const key = `${name}:${variant}`;

        const definitions =
            this.decorators.get(key) || this.decorators.get(`${name}:class`);

        if (!definitions) {
            return false;
        }

        definitions.forEach(definition =>
            definition.handler(event, {
                target,
                decorator,
                propertyKey,
            })
        );

        return true;
    }
}
