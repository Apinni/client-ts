import { Decorator, Node, Type } from 'ts-morph';

import { ShareableContext } from './shared';

export interface ClassMetadata {
    target: any;
    disabledDomains?: Partial<{
        '*': boolean;
        [domain: string]: boolean;
    }>;
    disabledReason?: string;
    path?: string;
    domains?: Array<string>;
    [key: string]: any;
}

export interface InternalClassMetadata extends ClassMetadata {
    decorator: Decorator;
}

type TypeDefinition =
    | {
          name?: string;
          model: string;
      }
    | {
          name?: string;
          type: Type;
          node: Node;
      };

type QueryDefinition = {
    name?: string;
    inline: string;
};

export interface MethodMetadata {
    path: string;
    method: string;
    query?: TypeDefinition | QueryDefinition;
    request?: TypeDefinition;
    responses?: Record<number, TypeDefinition>;
    target: any;
    propertyKey: string | symbol;
    descriptor: PropertyDescriptor;
    disabledDomains?: Partial<{
        '*': boolean;
        [domain: string]: boolean;
    }>;
    disabledReason?: string;
    domains?: Array<string>;
    [key: string]: any;
}

export interface InternalMethodMetadata extends MethodMetadata {
    decorator: Decorator;
}

export interface IGenerationContext extends ShareableContext {
    getClassMetadata(): ClassMetadata[];
    getMethodMetadata(): MethodMetadata[];
    getPreparedData(): MethodMetadata[];
    filterEnabled(): void;
}
