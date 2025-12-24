import {
    ApinniConfig,
    OverridedContext,
    PluginTypes,
    ShareablePlugin,
} from '@interfaces';
import { ApinniPlugin, Dependency, SharedContext } from '@interfaces';

import { Hooks, HooksParams } from './types';

export class PluginManagerModule {
    private plugins: PluginTypes[] = [];

    constructor(private readonly config: ApinniConfig) {
        this.plugins = this.resolveDependencies();
    }

    getPluginsCount() {
        return this.plugins.length;
    }

    private resolveDependencies(): PluginTypes[] {
        const pluginMap = new Map<string, PluginTypes>();
        const dependencies = new Map<string, string[]>();
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const result: PluginTypes[] = [];

        const collectPlugins = (plugin: PluginTypes) => {
            if (!plugin.name) throw new Error('Plugin missing name');
            if (pluginMap.has(plugin.name)) return;

            pluginMap.set(plugin.name, plugin);
            dependencies.set(
                plugin.name,
                plugin.dependencies?.map((dep: Dependency) => {
                    if (!dep.plugin.config?.shareable) {
                        throw new Error(
                            `Dependency ${dep.plugin.name} is not a ShareablePlugin`
                        );
                    }
                    return dep.plugin.name;
                }) || []
            );

            plugin.dependencies?.forEach((dep: Dependency) =>
                collectPlugins(dep.plugin)
            );
        };

        this.config.plugins.forEach(plugin => collectPlugins(plugin));

        const topologicalSort = (name: string) => {
            if (recursionStack.has(name)) {
                throw new Error(
                    `Circular dependency detected involving plugin: ${name}`
                );
            }
            if (visited.has(name)) return;

            recursionStack.add(name);
            const deps = dependencies.get(name) || [];
            deps.forEach(dep => {
                if (!pluginMap.has(dep)) {
                    throw new Error(`Dependency ${dep} not found`);
                }
                topologicalSort(dep);
            });
            recursionStack.delete(name);
            visited.add(name);
            const plugin = pluginMap.get(name)!;
            result.push(plugin);
        };

        pluginMap.forEach((_, name) => topologicalSort(name));
        return result;
    }

    async executeHook<T extends Hooks>(
        hookName: T,
        ...args: [...params: HooksParams[T]]
    ) {
        if (hookName === 'onInitialize') {
            return this.runOnInitializeHook(
                ...(args as HooksParams['onInitialize'])
            );
        }

        if (hookName === 'onAfterDecoratorsProcessed') {
            return this.runOnAfterDecoratorProcessed();
        }

        if (hookName === 'onRegisterMetadata') {
            return this.runOnRegisterMetadata(
                ...(args as HooksParams['onRegisterMetadata'])
            );
        }

        if (hookName === 'onConsumeDependencyContexts') {
            return this.runOnConsumeDependencies();
        }

        if (hookName === 'onGenerateTypes') {
            return this.runOnGenerateTypes(
                ...(args as HooksParams['onGenerateTypes'])
            );
        }
    }

    private async runOnInitializeHook(...params: HooksParams['onInitialize']) {
        await Promise.all(
            this.plugins.map(plugin => plugin.hooks.onInitialize(...params))
        );
    }

    private runOnAfterDecoratorProcessed() {
        this.plugins.forEach(plugin =>
            plugin.hooks.onAfterDecoratorsProcessed?.()
        );
    }

    private runOnRegisterMetadata(
        ...params: HooksParams['onRegisterMetadata']
    ) {
        this.plugins.forEach(plugin => {
            const isDependency = this.config.plugins.every(
                p => p.name !== plugin.name
            );
            const allowManipulation =
                !isDependency ||
                plugin.dependencies?.some(
                    (dep: Dependency) => dep.options?.allowContextManipulation
                );

            if (allowManipulation && plugin.hooks.onRegisterMetadata) {
                plugin.hooks.onRegisterMetadata(...params);
            }
        });
    }

    private runOnGenerateTypes(...params: HooksParams['onGenerateTypes']) {
        this.plugins.forEach(plugin => {
            const isDependency = this.config.plugins.every(
                p => p.name !== plugin.name
            );
            const allowManipulation =
                !isDependency ||
                plugin.dependencies?.some(
                    (dep: Dependency) => dep.options?.allowContextManipulation
                );

            if (allowManipulation && plugin.hooks.onGenerateTypes) {
                plugin.hooks.onGenerateTypes(...params);
            }
        });
    }

    private runOnConsumeDependencies() {
        const shareablePluginsContextMap = new WeakMap<
            ShareablePlugin,
            SharedContext
        >();

        this.plugins
            .filter(
                plugin =>
                    plugin.dependencies?.length &&
                    'onConsumeDependencyContexts' in plugin.hooks
            )
            .forEach(_plugin => {
                const plugin = _plugin as unknown as ApinniPlugin<
                    OverridedContext,
                    [Dependency]
                >;
                const contexts = plugin.dependencies.map(dep => {
                    if (!shareablePluginsContextMap.has(dep.plugin)) {
                        shareablePluginsContextMap.set(
                            dep.plugin,
                            dep.plugin.hooks.onProvideSharedContext()
                        );
                    }

                    const sharedContext = shareablePluginsContextMap.get(
                        dep.plugin
                    );

                    if (!sharedContext) {
                        throw new Error(
                            `Shared context not found for dependency ${dep.plugin.name}`
                        );
                    }
                    return sharedContext;
                });
                plugin.hooks.onConsumeDependencyContexts(
                    contexts as [SharedContext]
                );
            });
    }
}
