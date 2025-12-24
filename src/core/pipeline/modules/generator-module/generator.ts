import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Project } from 'ts-morph';

import { ApinniConfig, InternalMethodMetadata, JsonSchema } from '@interfaces';

import { DEFAULT_UTILITY_TYPES, PROXY_TYPES } from './constants';
import { DefinitionsResolverModule } from './submodules/definitions-resolver-module/definitions-resolver';
import { SchemaBuilderModule } from './submodules/schema-builder-module/schema-builder';
import { TypesLookupModule } from './submodules/types-lookup-module/types-lookup';
import {
    EndpointData,
    NamedInlineTypeEntry,
    NamedModelTypeEntry,
    NamedTsTypeEntry,
    SchemaBuilderEntry,
    TypesSchema,
} from './types';

interface EndpointStructure {
    query?: string;
    request?: string;
    responses?: Record<number, string>;
}

interface ApiStructure {
    [key: string]: { [method: string]: EndpointStructure };
}

const isModelEntry = (
    entry: SchemaBuilderEntry
): entry is NamedModelTypeEntry => 'model' in entry;

const isInlineEntry = (
    entry: SchemaBuilderEntry
): entry is NamedInlineTypeEntry => 'inline' in entry;

const isTypeEntry = (entry: SchemaBuilderEntry): entry is NamedTsTypeEntry =>
    'type' in entry;

const isInlineOrTypeEntry = (
    entry: SchemaBuilderEntry
): entry is NamedTsTypeEntry | NamedInlineTypeEntry =>
    isInlineEntry(entry) || isTypeEntry(entry);

function buildApiStructure(endpoints: EndpointData[]): ApiStructure {
    const structure: ApiStructure = {};

    for (const { path, method, query, request, responses } of endpoints) {
        if (!method) {
            continue;
        }
        if (!structure[path]) {
            structure[path] = {};
        }
        structure[path][method.toUpperCase()] = {
            query: query ?? 'never',
            request: request ?? 'never',
            responses: responses ?? 'never',
        };
    }

    return structure;
}

const getIndent = (level: number) => '  '.repeat(level);

const structureToString = (structure: ApiStructure) => {
    let result = '{\n';

    for (const [path, methods] of Object.entries(structure)) {
        result += `${getIndent(1)}["${path}"]: {\n`;

        for (const [method, endpoint] of Object.entries(methods)) {
            result += `${getIndent(2)}${method}: {\n`;

            if (endpoint.query) {
                result += `${getIndent(3)}query: ${endpoint.query};\n`;
            }

            result += `${getIndent(3)}request: ${endpoint.request};\n`;

            if (
                typeof endpoint.responses === 'string' ||
                !Object.keys(endpoint.responses || {}).length
            ) {
                result += `${getIndent(3)}responses: never;\n`;
            } else {
                result += `${getIndent(3)}responses: {\n`;
                Object.entries(endpoint.responses || {}).forEach(
                    ([status, response]) => {
                        result += `${getIndent(4)}${status.replace(/[^0-9]/g, '')}: ${response};\n`;
                    }
                );
                result += `${getIndent(3)}};\n`;
            }

            result += `${getIndent(2)}};\n`;
        }
        result += `${getIndent(1)}};\n`;
    }

    result += `}`;
    return result;
};

function transformToName(input: { method: string; path: string }): string {
    // Remove leading/trailing slashes and query strings
    const cleanedPath = input.path.replace(/^\/+|\/+$/g, '').split('?')[0];

    // Split on `/`, `-`, `_` and transform params to "ByX"
    const segments = cleanedPath
        .split('/')
        .flatMap(part => part.split(/[-_]/))
        .map(str => {
            if (str.startsWith(':')) {
                const name = str.slice(1);
                return 'By' + name.charAt(0).toUpperCase() + name.slice(1);
            }
            return str;
        });

    // Capitalize helper
    const capitalize = (str: string) =>
        str.charAt(0).toUpperCase() + str.slice(1);

    return [
        capitalize(input.method.toLowerCase()),
        ...segments.map(capitalize),
    ].join('');
}

export class GeneratorModule {
    private typesLookupModule: TypesLookupModule;
    private schemaBuilderModule: SchemaBuilderModule;
    private definitionsResolverModule: DefinitionsResolverModule;
    constructor(
        private readonly config: ApinniConfig,
        project: Project
    ) {
        this.typesLookupModule = new TypesLookupModule(project);
        this.schemaBuilderModule = new SchemaBuilderModule(project);
        this.definitionsResolverModule = new DefinitionsResolverModule();
    }

    async generate(endpointsMetadata: InternalMethodMetadata[]) {
        this.typesLookupModule.buildTypeIndexes();

        // const types = endpointsMetadata.flatMap(endpoint => {
        //     const endpointTypes = [];

        //     if (endpoint.query && !('inline' in endpoint.query)) {
        //         endpointTypes.push(
        //             'model' in endpoint.query
        //                 ? { model: endpoint.query.model }
        //                 : {
        //                       type: endpoint.query.type,
        //                       node: endpoint.query.node,
        //                   }
        //         );
        //     }

        //     if (endpoint.request && 'model' in endpoint.request) {
        //         endpointTypes.push({ model: endpoint.request.model });
        //     } else if (endpoint.request && 'type' in endpoint.request) {
        //         endpointTypes.push({
        //             type: endpoint.request.type,
        //             node: endpoint.request.node,
        //         });
        //     }

        //     if (endpoint.responses) {
        //         Object.values(endpoint.responses).map(response => {
        //             if ('model' in response) {
        //                 endpointTypes.push({ model: response.model });
        //             } else {
        //                 endpointTypes.push({
        //                     type: response.type,
        //                     node: response.node,
        //                 });
        //             }
        //         });
        //     }

        //     return endpointTypes as Array<
        //         { model: string } | { type: Type; node?: Node }
        //     >;
        // });

        // const typeDefinitions = this.typesLookupModule.lookup(
        //     types.filter(info => 'model' in info).map(({ model }) => model)
        // );

        // this.schemaBuilderModule.storeCollectedTypes(
        //     typeDefinitions.join('\n\n')
        // );

        const endpointsMap = new Map<string, number>();
        const endpointsByDomain = new Map<string, string[]>();

        endpointsMetadata.forEach((endpoint, index) => {
            endpointsMap.set(endpoint.path, index);
        });

        for (const endpoint of endpointsMetadata) {
            const domains = endpoint.domains || ['api'];

            const disabledDomains = endpoint.disabledDomains || {};

            domains.forEach(domain => {
                if (disabledDomains[domain]) {
                    return;
                }

                if (
                    typeof disabledDomains[domain] !== 'boolean' &&
                    disabledDomains['*']
                ) {
                    return;
                }

                if (!endpointsByDomain.get(domain)) {
                    endpointsByDomain.set(domain, []);
                }

                endpointsByDomain.get(domain)?.push(endpoint.path);
            });
        }

        const cwd = process.cwd();
        const outputDir = this.config.outputPath
            ? resolve(cwd, this.config.outputPath)
            : cwd;

        await mkdir(outputDir, { recursive: true });

        const promises = [] as Array<Promise<void>>;

        const { resolvedEndpoints, typesToResolve } =
            this.prepareEndpointsWithTypes(
                endpointsMetadata,
                Array.from(endpointsByDomain.keys())
            );

        const modelTypes = this.typesLookupModule.lookupNode(
            typesToResolve.filter(isModelEntry)
        );

        const normalizedTypes: Array<NamedTsTypeEntry | NamedInlineTypeEntry> =
            [...typesToResolve.filter(isInlineOrTypeEntry), ...modelTypes];

        const schema = this.schemaBuilderModule.generateSchema(
            normalizedTypes as SchemaBuilderEntry[]
        );

        const mappedEndpoints =
            Object.keys(schema.mappedReferences).length > 0
                ? resolvedEndpoints.map(endpoint => {
                      const { request, responses, query } = endpoint;
                      const mappedQuery =
                          schema.mappedReferences[query || ''] || query;

                      const mappedRequest =
                          schema.mappedReferences[request || ''] || request;

                      const mappedResponses =
                          responses &&
                          Object.fromEntries(
                              Object.entries(responses).map(
                                  ([status, response]) => [
                                      status,
                                      schema.mappedReferences[response || ''] ||
                                          response,
                                  ]
                              )
                          );

                      return {
                          ...endpoint,
                          ...(mappedQuery && { query: mappedQuery }),
                          ...(mappedRequest && { request: mappedRequest }),
                          ...(mappedResponses && {
                              responses: mappedResponses,
                          }),
                      };
                  })
                : resolvedEndpoints;

        const apiSchema = {
            endpoints: mappedEndpoints,
            schema,
        };

        if (this.config.generateSchemaFiles !== false) {
            await writeFile(
                'api-schema.json',
                JSON.stringify(apiSchema, null, 2),
                'utf-8'
            );
        }

        for (const [domain, endpoints] of endpointsByDomain.entries()) {
            const domainEndpoints = mappedEndpoints.filter(ep =>
                endpoints.includes(ep.path)
            );

            const referencedNames = new Set<string>();
            const toVisit = new Set<string>();

            // Start with top-level references from endpoints (query/request/responses are strings)
            domainEndpoints.forEach(ep => {
                if (typeof ep.query === 'string' && ep.query) {
                    toVisit.add(ep.query);
                }
                if (typeof ep.request === 'string' && ep.request) {
                    toVisit.add(ep.request);
                }
                if (ep.responses) {
                    Object.values(ep.responses).forEach(resp => {
                        if (typeof resp === 'string' && resp) {
                            toVisit.add(resp);
                        }
                    });
                }
            });

            // Combined pool of all available schemas
            const allSchemas: Record<string, JsonSchema> = {
                ...schema.schema,
                ...schema.refs,
            };

            // Traverse to collect all transitive references (BFS-style to handle dependencies)
            while (toVisit.size > 0) {
                const currentName = toVisit.values().next().value as string;
                toVisit.delete(currentName);

                if (referencedNames.has(currentName)) continue;
                referencedNames.add(currentName);

                const currentSchema = allSchemas[currentName];
                if (!currentSchema) continue;

                // Recursively collect nested refs from this schema
                const collectNested = (s: JsonSchema) => {
                    if (
                        'type' in s &&
                        s.type === 'ref' &&
                        'name' in s &&
                        s.name
                    ) {
                        if (!referencedNames.has(s.name)) {
                            toVisit.add(s.name);
                        }
                        return;
                    }

                    if ('anyOf' in s && Array.isArray(s.anyOf)) {
                        s.anyOf.forEach(collectNested);
                    }
                    if ('allOf' in s && Array.isArray(s.allOf)) {
                        s.allOf.forEach(collectNested);
                    }
                    if ('properties' in s && s.properties) {
                        Object.values(s.properties).forEach(collectNested);
                    }
                    if ('indexedProperties' in s && s.indexedProperties) {
                        collectNested(s.indexedProperties);
                    }
                    if ('items' in s) {
                        if (Array.isArray(s.items)) {
                            s.items.forEach(collectNested);
                        } else if (s.items) {
                            collectNested(s.items);
                        }
                    }
                    // Note: No need for enum/values, string/number/etc. as they don't ref
                };

                collectNested(currentSchema);
            }

            const domainSchema: Omit<TypesSchema, 'mappedReferences'> = {
                schema: {},
                refs: {},
            };

            for (const name of referencedNames) {
                if (schema.schema[name]) {
                    domainSchema.schema[name] = schema.schema[name];
                }
                if (schema.refs[name]) {
                    domainSchema.refs[name] = schema.refs[name];
                }
            }

            const generatedTypes =
                this.definitionsResolverModule.generate(domainSchema);

            const output = this.assemblyOutput({
                domain,
                endpoints: domainEndpoints,
                typesDefinitions: generatedTypes,
            });

            const fileName = `${domain}-types.d.ts`;
            const outputPath = join(outputDir, fileName);

            promises.push(writeFile(outputPath, output, 'utf-8'));
        }

        await Promise.all(promises);

        return apiSchema;
    }

    private prepareEndpointsWithTypes(
        endpoints: InternalMethodMetadata[],
        domains: string[]
    ) {
        const resolvedEndpoints: EndpointData[] = [];
        const typesToResolve: SchemaBuilderEntry[] = [];

        for (const endpoint of endpoints) {
            const query = endpoint.query
                ? {
                      ...endpoint.query,
                      name:
                          ('name' in endpoint.query && endpoint.query.name) ||
                          `${transformToName(endpoint)}Query`,
                  }
                : null;

            const request = endpoint.request
                ? {
                      name:
                          endpoint.request.name ||
                          `${transformToName(endpoint)}Request`,
                      ...('model' in endpoint.request
                          ? {
                                model: endpoint.request.model,
                            }
                          : {
                                type: endpoint.request.type,
                                node: endpoint.request.node,
                            }),
                  }
                : null;

            const responses = endpoint.responses
                ? Object.fromEntries(
                      Object.entries(endpoint.responses).map(
                          ([status, response]) => [
                              status,
                              {
                                  name:
                                      response.name ||
                                      `${transformToName(endpoint)}${Object.keys(endpoint.responses || {}).length > 0 ? status : ''}Response`,
                                  ...('model' in response
                                      ? {
                                            model: response.model,
                                        }
                                      : {
                                            type: response.type,
                                            node: response.node,
                                        }),
                              },
                          ]
                      )
                  )
                : null;

            const disabledDomains = endpoint.disabledDomains || {};

            const wildcardDisabled = disabledDomains['*'] === true;

            const resolvedDisabledDomains = domains.filter(domain => {
                const setting = disabledDomains[domain];
                return setting !== undefined ? setting : wildcardDisabled;
            });

            resolvedEndpoints.push({
                path: endpoint.path,
                method: endpoint.method,
                query: query?.name,
                domains: endpoint.domains || ['api'],
                disabledDomains: resolvedDisabledDomains,
                request: request?.name,
                responses: responses
                    ? Object.fromEntries(
                          Object.entries(responses).map(
                              ([status, { name }]) => [status, name]
                          )
                      )
                    : undefined,
            });

            if (query) {
                typesToResolve.push(query);
            }

            if (request) {
                typesToResolve.push(request);
            }

            if (responses) {
                typesToResolve.push(...Object.values(responses));
            }
        }

        return {
            resolvedEndpoints,
            typesToResolve,
        };
    }

    private assemblyOutput({
        domain,
        endpoints,
        typesDefinitions,
    }: {
        domain: string;
        endpoints: EndpointData[];
        typesDefinitions: string;
    }) {
        const supportedMethods = Array.from(
            new Set(endpoints.map(e => e.method?.toUpperCase()).filter(Boolean))
        );

        const output: string[] = [
            `// Auto-generated API types for domain: ${domain}\n\n`,
        ];

        output.push(`${typesDefinitions}\n\n`);

        if (supportedMethods.length > 0) {
            output.push(
                `export type ApiMethod = ${supportedMethods
                    .map(m => `'${m}'`)
                    .join(' | ')};\n\n`
            );
        } else {
            output.push(`export type ApiMethod = never;\n\n`);
        }

        output.push(`${PROXY_TYPES}\n\n`);

        const structure = buildApiStructure(endpoints);

        output.push(
            `export type Api = BuildApi<${structureToString(structure)}>;\n\n`
        );

        output.push(DEFAULT_UTILITY_TYPES);

        return output.join('');
    }
}
