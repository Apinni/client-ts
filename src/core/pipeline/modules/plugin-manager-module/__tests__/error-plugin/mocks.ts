import { Dependency, ShareablePlugin } from '@interfaces';
import { buildPlugin } from '@utils';

export const createShareablePlugin = (name: string) =>
    buildPlugin({
        name,
        config: { shareable: true },
        hooks: {
            onInitialize: () => {},
            onProvideSharedContext: () => ({ data: null }),
        },
    });

export const createPlugin = <T extends [ShareablePlugin, ...ShareablePlugin[]]>(
    name: string,
    dependencies: T
) =>
    buildPlugin({
        name,
        dependencies: dependencies.map(dep => ({ plugin: dep })) as [
            Dependency,
        ],
        hooks: {
            onInitialize: () => {},
            onConsumeDependencyContexts: () => {},
        },
    });
