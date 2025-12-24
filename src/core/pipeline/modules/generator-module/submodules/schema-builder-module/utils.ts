import { JSDoc, Node, Type } from 'ts-morph';

import { SchemaDefinitionProperties } from '../../types';

export const SUPPORTED_JSDOCS_TAGS = [
    'description',
    'example',
    'deprecated',
    'default',
] as const satisfies Array<keyof SchemaDefinitionProperties>;

type DefinitionProperties = Record<keyof SchemaDefinitionProperties, string>;

export const extractJSDocsToDefinitionProperties = (
    jsDocs: Array<JSDoc>
): DefinitionProperties => {
    const docs = jsDocs
        .flatMap(doc => [
            doc.getCommentText(),
            ...doc
                .getTags()
                .filter(tag =>
                    SUPPORTED_JSDOCS_TAGS.includes(
                        tag.getTagName() as Exclude<
                            keyof SchemaDefinitionProperties,
                            'global'
                        >
                    )
                )
                .map(tag => tag.getStructure()),
        ])
        .filter(Boolean);

    return docs.reduce((acc, doc) => {
        const property =
            typeof doc === 'string'
                ? 'global'
                : (doc?.tagName as keyof SchemaDefinitionProperties);
        const text = typeof doc === 'string' ? doc : doc?.text;

        return {
            ...acc,
            [property]: acc[property] ? `${acc[property]}\n${text}` : text,
        };
    }, {} as DefinitionProperties);
};

export const resolveNodeByType = (type: Type) => {
    const node =
        type.getAliasSymbol()?.getDeclarations()[0] ||
        type.getSymbol()?.getDeclarations()[0];
    return node;
};

export const mergeWithJSDocs = <T>(initial: T, type: Type) => {
    const node = resolveNodeByType(type);

    return {
        ...initial,
        ...(Node.isJSDocable(node) &&
            extractJSDocsToDefinitionProperties(node.getJsDocs())),
    };
};
