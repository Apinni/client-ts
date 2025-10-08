import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Node, Project, Type } from 'ts-morph';

import { ApinniConfig, InternalMethodMetadata } from '@interfaces';

import { DEFAULT_UTILITY_TYPES, PROXY_TYPES } from './constants';
import { DefinitionsResolverModule } from './submodules/definitions-resolver-module/definitions-resolver';
import { SchemaBuilderModule } from './submodules/schema-builder-module/schema-builder';
import { TypesLookupModule } from './submodules/types-lookup-module/types-lookup';

interface EndpointStructure {
    query?: string;
    request?: string;
    responses?: Record<number, string>;
}

interface ApiStructure {
    [key: string]: { [method: string]: EndpointStructure };
}

export type EndpointData = {
    path: string;
    method: string;
    query?: string;
    request?: string;
    responses?: Record<number, string>;
};

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

        const types = endpointsMetadata.flatMap(endpoint => {
            const endpointTypes = [];

            if (endpoint.query && !Array.isArray(endpoint.query)) {
                endpointTypes.push(
                    'model' in endpoint.query
                        ? { model: endpoint.query.model }
                        : {
                              type: endpoint.query.type,
                              node: endpoint.query.node,
                          }
                );
            }

            if (endpoint.request && 'model' in endpoint.request) {
                endpointTypes.push({ model: endpoint.request.model });
            } else if (endpoint.request && 'type' in endpoint.request) {
                endpointTypes.push({
                    type: endpoint.request.type,
                    node: endpoint.request.node,
                });
            }

            if (endpoint.responses) {
                Object.values(endpoint.responses).map(response => {
                    if ('model' in response) {
                        endpointTypes.push({ model: response.model });
                    } else {
                        endpointTypes.push({
                            type: response.type,
                            node: response.node,
                        });
                    }
                });
            }

            return endpointTypes as Array<
                { model: string } | { type: Type; node?: Node }
            >;
        });

        const typeDefinitions = this.typesLookupModule.lookup(
            types.filter(info => 'model' in info).map(({ model }) => model)
        );

        this.schemaBuilderModule.storeCollectedTypes(
            typeDefinitions.join('\n\n')
        );

        const endpointsByDomain = new Map<string, InternalMethodMetadata[]>();

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

                endpointsByDomain.get(domain)?.push(endpoint);
            });
        }

        const cwd = process.cwd();
        const outputDir = this.config.outputPath
            ? resolve(cwd, this.config.outputPath)
            : cwd;

        await mkdir(outputDir, { recursive: true });

        const promises = [] as Array<Promise<void>>;

        for (const [domain, endpoints] of endpointsByDomain.entries()) {
            const { resolvedEndpoints, typesToResolve } =
                this.prepareEndpointsWithTypes(endpoints);

            const schema =
                this.schemaBuilderModule.generateSchema(typesToResolve);

            const mappedEndpoints =
                Object.keys(schema.mappedReferences).length > 0
                    ? resolvedEndpoints.map(endpoint => {
                          const { request, responses } = endpoint;
                          const mappedRequest =
                              schema.mappedReferences[request || ''] || request;

                          const mappedResponses =
                              responses &&
                              Object.fromEntries(
                                  Object.entries(responses).map(
                                      ([status, response]) => [
                                          status,
                                          schema.mappedReferences[
                                              response || ''
                                          ] || response,
                                      ]
                                  )
                              );

                          return {
                              ...endpoint,
                              ...(mappedRequest && { request: mappedRequest }),
                              ...(mappedResponses && {
                                  responses: mappedResponses,
                              }),
                          };
                      })
                    : resolvedEndpoints;

            await writeFile(
                `my-schema-${domain}.json`,
                JSON.stringify(schema, null, 2)
            );

            const generatedTypes =
                this.definitionsResolverModule.generate(schema);

            const output = this.assemblyOutput({
                domain,
                endpoints: mappedEndpoints,
                typesDefinitions: generatedTypes,
            });

            const fileName = `${domain}-types.d.ts`;
            const outputPath = join(outputDir, fileName);

            promises.push(writeFile(outputPath, output, 'utf-8'));
        }

        return await Promise.all(promises);
    }

    private prepareEndpointsWithTypes(endpoints: InternalMethodMetadata[]) {
        const resolvedEndpoints = [] as EndpointData[];
        const typesToResolve = [] as (
            | { name: string; model: string }
            | { name: string; inline: string }
            | { name: string; type: Type; node?: Node }
        )[];

        for (const endpoint of endpoints) {
            const query = endpoint.query
                ? {
                      ...(Array.isArray(endpoint.query)
                          ? {
                                name: `${transformToName(endpoint)}Query`,
                                inline: `{ ${endpoint.query.map(name => `${name}: string;`).join(' ')} }`,
                            }
                          : {
                                name:
                                    endpoint.query.name ||
                                    `${transformToName(endpoint)}Query`,
                                ...('model' in endpoint.query
                                    ? {
                                          model: endpoint.query.model,
                                      }
                                    : {
                                          type: endpoint.query.type,
                                          node: endpoint.query.node,
                                      }),
                            }),
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

            resolvedEndpoints.push({
                path: endpoint.path,
                method: endpoint.method,
                query: query?.name,
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
