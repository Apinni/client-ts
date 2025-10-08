import { IApiPathArgs } from 'swagger-express-ts';
import { IApiOperationArgsBase } from 'swagger-express-ts/i-api-operation-args.base';
import { Decorator, MethodDeclaration } from 'ts-morph';

import { ShareableContext } from '@interfaces/shared';

import { extractDecoratorArgValue } from '../../src';
import { ENDPOINT_DECORATORS } from './constants';

type DecoratorNames = (typeof ENDPOINT_DECORATORS)[number];

const mapDecoratorNameToMethod: Record<DecoratorNames, string> = {
    ApiOperationGet: 'GET',
    ApiOperationPost: 'POST',
    ApiOperationPatch: 'PATCH',
    ApiOperationPut: 'PUT',
    ApiOperationDelete: 'DELETE',
};

type WithTarget<T> = T & {
    target: any;
};

export interface LocalContext {
    paths: Array<WithTarget<IApiPathArgs>>;
    operations: Array<
        WithTarget<
            IApiOperationArgsBase & { method: string; methodName: string }
        >
    >;
}

export const localContext: LocalContext = {
    paths: [],
    operations: [],
};

export const ApiOperationHandler = (
    event: 'register' | 'unregister',
    {
        target,
        decorator,
        propertyKey,
    }: {
        target: any;
        decorator: Decorator;
        propertyKey?: string | symbol;
    }
) => {
    const methodName = String(
        propertyKey || (decorator.getParent() as MethodDeclaration).getName()
    );

    if (event === 'unregister') {
        localContext.operations = localContext.operations.filter(
            operation =>
                !(
                    operation.target === target &&
                    operation.methodName === methodName
                )
        );
        return;
    }

    const options = extractDecoratorArgValue<IApiOperationArgsBase>(decorator);

    if (!options) {
        return;
    }

    localContext.operations.push({
        ...options,
        target,
        method: mapDecoratorNameToMethod[
            decorator.getName() as (typeof ENDPOINT_DECORATORS)[number]
        ],
        methodName,
    });
};

export const ApiPathHandler = (
    event: 'register' | 'unregister',
    {
        decorator,
        target,
    }: {
        decorator: Decorator;
        target: any;
    }
) => {
    if (event === 'unregister') {
        return (localContext.paths = localContext.paths.filter(
            path => path.target !== target
        ));
    }

    const options = extractDecoratorArgValue<IApiPathArgs>(decorator);

    if (!options) {
        return;
    }

    localContext.paths.push({
        ...options,
        target,
    });
};

const normalizeParams = (path: string) => {
    return path.replace(/{(\w*)}/g, value => `:${value.slice(1, -1)}`);
};

export const finalize = (context: ShareableContext) => {
    localContext.paths.forEach(({ target, path }) => {
        context.registerClassMetadata(target, {
            path: normalizeParams(path),
        });
    });

    localContext.operations.forEach(operation => {
        const request = operation.parameters?.body?.model
            ? {
                  name: operation.parameters?.body?.name,
                  model: operation.parameters?.body?.model,
              }
            : null;

        const responses = Object.fromEntries(
            Object.entries(operation.responses || {}).map(
                ([status, response]) => [
                    status,
                    {
                        model: response.model || 'unknown',
                    },
                ]
            )
        );

        context.registerMethodMetadata(operation.target, operation.methodName, {
            method: operation.method,
            path: normalizeParams(operation.path || ''),
            ...(request && {
                request,
            }),
            ...(Object.keys(responses).length > 0 && {
                responses,
            }),
        });
    });
};
