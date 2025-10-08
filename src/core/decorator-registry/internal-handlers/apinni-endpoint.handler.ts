import { Node, Type } from 'ts-morph';

import { DecoratorDefinition } from '@interfaces';
import { extractDecoratorArgValue } from '@utils';

import { EndpointOptions } from '../../../decorators';
import { GenerationContext } from '../../generation-context';

function stripQuotes(str: string): string {
    if (!str) return str;
    return str.replace(/^["']|["']$/g, '');
}

function extractReturnTypeAndNode(
    decorator: Node
): { type: Type; node: Node } | null {
    const method = decorator.getParentOrThrow();
    const signature = method.getType().getCallSignatures()[0];
    if (!signature) return null;

    const returnType = signature.getReturnType();
    return { type: returnType, node: signature.getDeclaration() };
}

type TypeData = {
    type: Type;
    node: Node;
    name?: string;
};

const getTypeData = (propertyType: Type, node: Node): TypeData | null => {
    const type = propertyType.getProperty('type')?.getTypeAtLocation(node);
    const name = propertyType
        .getProperty('name')
        ?.getTypeAtLocation(node)
        ?.getText();

    if (!type) {
        return null;
    }

    return { type, node, name: name && stripQuotes(name) };
};

type PropertyName = 'query' | 'request' | 'responses';

const resolveTypeDataByTypeArgumentProperty = <T extends PropertyName>(
    typeArgument: Node,
    property: T
):
    | (T extends 'responses' ? Record<number, TypeData> | null : TypeData)
    | null => {
    const propertyType = typeArgument
        .getType()
        .getProperty(property)
        ?.getTypeAtLocation(typeArgument);

    if (!property || !propertyType) {
        return null;
    }

    if (property === 'request' || property === 'query') {
        const data = getTypeData(propertyType, typeArgument);

        if (!data) {
            return null;
        }

        return data;
    }

    const numberProps = propertyType
        .getProperties()
        .filter(p => /^\d+/.test(p.getName()));

    const mapped: Record<number, TypeData> = {};

    if (numberProps.length > 0) {
        for (const prop of numberProps) {
            const statusCode = parseInt(prop.getName(), 10);
            const statusType = prop.getTypeAtLocation(typeArgument);
            const data = getTypeData(statusType, typeArgument);

            if (!data) {
                continue;
            }
            mapped[statusCode] = data;
        }

        if (Object.keys(mapped).length === 0) {
            return null;
        }

        return mapped as T extends 'responses'
            ? Record<number, TypeData> | null
            : TypeData;
    }

    const data = getTypeData(propertyType, typeArgument);

    if (!data) {
        return null;
    }

    mapped[200] = data;

    return mapped as T extends 'responses'
        ? Record<number, TypeData> | null
        : TypeData;
};

export const ApinniEndpointHandler: DecoratorDefinition<'method'>['handler'] = (
    event,
    { target, propertyKey, decorator }
) => {
    if (event !== 'register') {
        return;
    }

    const context = GenerationContext.getInstance();

    const args = extractDecoratorArgValue<EndpointOptions>(decorator);

    if (!args?.responses) {
        const data = extractReturnTypeAndNode(decorator);

        if (data) {
            context.registerMethodMetadata(target, propertyKey, {
                responses: {
                    200: {
                        type: data.type,
                        node: data.node,
                    },
                },
            });
        }
    }

    context.registerMethodMetadata(target, propertyKey, {
        ...args,
    });

    const callExpr = decorator?.getCallExpression();
    const [typeArg] = callExpr?.getTypeArguments() || [];

    if (typeArg) {
        const query = resolveTypeDataByTypeArgumentProperty(typeArg, 'query');

        const request = resolveTypeDataByTypeArgumentProperty(
            typeArg,
            'request'
        );

        const responses = resolveTypeDataByTypeArgumentProperty(
            typeArg,
            'responses'
        );

        context.registerMethodMetadata(target, propertyKey, {
            ...(query && {
                query,
            }),
            ...(request && {
                request,
            }),
            ...(responses && {
                responses,
            }),
        });
    }
};
