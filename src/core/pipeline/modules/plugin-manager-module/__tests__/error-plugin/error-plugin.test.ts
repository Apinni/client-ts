import { describe, expect, it } from 'vitest';

import { ApinniConfig, ApinniPlugin } from '@interfaces';

import { PluginManagerModule } from '../../plugin-manager';
import { createPlugin, createShareablePlugin } from './mocks';

describe('PluginModule full lifecycle', () => {
    it('should correctly resolve dependencies and sort topologically', () => {
        const shareA = createShareablePlugin('SharePluginA');
        const shareB = createShareablePlugin('SharePluginB');
        const shareC = createShareablePlugin('SharePluginC');

        const plugin = createPlugin('TestPlugin', [shareA, shareB]);

        const config = {
            plugins: [plugin, shareC],
        } satisfies ApinniConfig;

        const module = new PluginManagerModule(config);
        const names = module['plugins'].map(p => p.name);

        // SharePluginA and SharePluginB should come before TestPlugin
        const indexA = names.indexOf('SharePluginA');
        const indexB = names.indexOf('SharePluginB');
        const indexC = names.indexOf('SharePluginC');
        const index = names.indexOf('TestPlugin');

        expect(indexA).toBeLessThan(index);
        expect(indexB).toBeLessThan(index);
        expect(indexC).toBeGreaterThan(index);
    });

    it('should throw error if a dependency is missing', () => {
        const brokenPlugin = createPlugin('broken', [
            { name: 'NotShareablePluginName', hooks: {} } as any,
        ]);

        const brokenConfig = {
            plugins: [brokenPlugin] as unknown as [ApinniPlugin],
        };

        expect(() => new PluginManagerModule(brokenConfig)).toThrow(
            /Dependency NotShareablePluginName is not a ShareablePlugin/
        );
    });

    it('should throw error on circular dependencies', () => {
        const sharedA1 = createShareablePlugin('shared-a1');
        const sharedB1 = createShareablePlugin('shared-b1');
        const sharedC1 = createShareablePlugin('shared-c1');

        sharedA1.dependencies = [{ plugin: sharedB1 }] as unknown as [];
        sharedB1.dependencies = [{ plugin: sharedC1 }] as unknown as [];
        sharedC1.dependencies = [{ plugin: sharedA1 }] as unknown as [];

        const circularConfig = {
            plugins: [sharedA1, sharedB1, sharedC1],
        } satisfies ApinniConfig;

        expect(() => new PluginManagerModule(circularConfig)).toThrow(
            /Circular dependency detected/
        );
    });
});
