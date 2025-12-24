import { join } from 'path';

import {
    ClassMetadata,
    IGenerationContext,
    InternalMethodMetadata,
    MethodMetadata,
} from '@interfaces';

function combinePaths(basePath: string | undefined, path: string): string {
    const cleanBasePath = basePath?.replace(/\/+$/, '') || '';
    const cleanPath = path?.replace(/^\/+/, '');

    // Join the paths
    const fullPath = join(...[cleanBasePath, cleanPath].filter(Boolean));

    // Deduplicate params like /:id/:id/:id → /:id/:id_1/:id_2
    const seen: Record<string, number> = {};
    return fullPath.replace(/:([a-zA-Z0-9_]+)/g, (match, param) => {
        if (seen[param] === undefined) {
            seen[param] = 0;
            return `:${param}`;
        }
        seen[param]++;
        return `:${param}_${seen[param]}`;
    });
}

const normalizeMetadata = (metadata: Partial<MethodMetadata>) =>
    Object.fromEntries(
        Object.entries(metadata)
            .filter(([_, v]) => v !== undefined)
            .map(([key, value]) =>
                key === 'responses'
                    ? [
                          key,
                          Object.fromEntries(
                              Object.entries(value).map(
                                  ([status, response]) => [
                                      status.replace(/[^0-9]/g, ''),
                                      response,
                                  ]
                              )
                          ),
                      ]
                    : [key, value]
            )
    );

export class GenerationContext implements IGenerationContext {
    private static instance: GenerationContext | null = null;
    private classMetadata: ClassMetadata[] = [];
    private methodMetadata: InternalMethodMetadata[] = [];

    public static getInstance(): GenerationContext {
        if (!GenerationContext.instance) {
            GenerationContext.instance = new GenerationContext();
        }
        return GenerationContext.instance;
    }

    public removeMetadataByTarget(target: any) {
        this.classMetadata = this.classMetadata.filter(
            cm => cm.target !== target
        );
        this.methodMetadata = this.methodMetadata.filter(
            m => !(m.target === target)
        );
    }

    public unregisterClass(target: any): void {
        this.classMetadata = this.classMetadata.filter(cm => {
            return cm.target !== target;
        });
    }

    public unregisterMethod(target: any, propertyKey: string | symbol): void {
        this.methodMetadata = this.methodMetadata.filter(
            m => !(m.target === target && m.propertyKey === propertyKey)
        );
    }

    public registerClassMetadata(
        target: any,
        metadata: Partial<ClassMetadata>
    ): void {
        const existing = this.classMetadata.find(cm => cm.target === target);

        if (existing) {
            this.classMetadata.splice(this.classMetadata.indexOf(existing), 1, {
                ...existing,
                ...Object.fromEntries(
                    Object.entries(metadata).filter(([_, v]) => v !== undefined)
                ),
            });
        } else {
            this.classMetadata.push({ target, ...metadata });
        }
    }

    public registerMethodMetadata(
        target: any,
        propertyKey: string | symbol,
        metadata: Partial<MethodMetadata>
    ): void {
        const existing = this.methodMetadata.find(
            m => m.target === target && m.propertyKey === propertyKey
        );

        if (existing) {
            this.methodMetadata.splice(
                this.methodMetadata.indexOf(existing),
                1,
                {
                    ...existing,
                    ...normalizeMetadata(metadata),
                }
            );
        } else {
            this.methodMetadata.push({
                target,
                propertyKey,
                ...normalizeMetadata(metadata),
            } as InternalMethodMetadata);
        }
    }

    public getClassMetadata(): ClassMetadata[] {
        return this.classMetadata;
    }

    public getMethodMetadata(): MethodMetadata[] {
        return this.methodMetadata;
    }

    public getPreparedData(): InternalMethodMetadata[] {
        const methods = this.methodMetadata.map(metadata => {
            const classMetadata = this.classMetadata.find(controller => {
                return controller.target === metadata.target;
            });

            let mergedDomains = {
                ...classMetadata?.disabledDomains,
            };

            if (typeof metadata.disabledDomains?.['*'] === 'boolean') {
                mergedDomains = {
                    ...metadata.disabledDomains,
                };
            } else {
                mergedDomains = {
                    ...mergedDomains,
                    ...metadata.disabledDomains,
                };
            }

            return {
                ...metadata,
                path: combinePaths(classMetadata?.path, metadata.path),
                domains: classMetadata?.domains,
                ...(Object.keys(mergedDomains).length && {
                    disabledDomains: mergedDomains,
                    disabledReason:
                        metadata.disabledReason ||
                        classMetadata?.disabledReason,
                }),
            };
        });

        return methods;
    }

    public filterEnabled(): void {
        this.methodMetadata = this.methodMetadata.filter(method => {
            const classMeta = this.classMetadata.find(
                cm =>
                    cm.target === method.target ||
                    cm.target === method.target.prototype?.constructor
            );

            const isClassDisabled = classMeta?.disabled ?? false;
            const isMethodDisabled = method.disabled ?? false;
            const isEnabled = !(isClassDisabled || isMethodDisabled);

            return isEnabled;
        });

        this.classMetadata = this.classMetadata.filter(cm => !cm.disabled);
    }

    public clear(): void {
        this.classMetadata = [];
        this.methodMetadata = [];
    }
}
