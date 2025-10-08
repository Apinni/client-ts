import { beforeEach, describe, expect, it } from 'vitest';

import { ApinniConfig } from '@interfaces';

import { PluginManagerModule } from '../../plugin-manager';
import { MockContext, MockRegistry } from '../services-mocks';
import { buildTestPlugin, TestDecoratorName } from './mocks';

const MOCK_TARGET = {
    timestamp: Date.now(),
};

describe('SimplePlugin', () => {
    let registry: MockRegistry;
    let context: MockContext;
    let plugin: ReturnType<typeof buildTestPlugin>['plugin'];
    let pluginContext: ReturnType<typeof buildTestPlugin>['testContext'];
    let config: ApinniConfig;

    beforeEach(() => {
        registry = new MockRegistry();
        context = new MockContext();

        const { plugin: _plugin, testContext } = buildTestPlugin();
        [plugin, pluginContext] = [_plugin, testContext];

        config = {
            plugins: [plugin],
        } satisfies ApinniConfig;
    });

    it('should execute all lifecycle hooks with correct effects', () => {
        const module = new PluginManagerModule(config);

        const names = module['plugins'].map(p => p.name);
        expect(names[0]).toBe('TestPlugin');

        module.executeHook('onInitialize', registry);
        expect(registry.decorators.size).toBe(1);

        registry.trigger('register', TestDecoratorName, MOCK_TARGET);
        expect(pluginContext.get(MOCK_TARGET)).toBeDefined();

        registry.trigger('unregister', TestDecoratorName, MOCK_TARGET);
        expect(pluginContext.get(MOCK_TARGET)).toBeUndefined();

        registry.trigger('register', TestDecoratorName, MOCK_TARGET);
        expect(pluginContext.get(MOCK_TARGET)).toBeDefined();
        expect(pluginContext.get(MOCK_TARGET)).toBe('target_registered');

        module.executeHook('onAfterDecoratorsProcessed');
        expect(pluginContext.get(MOCK_TARGET)).toBe(
            'target_registered_modified'
        );

        // Expect global context to be empty
        expect(context.classes.length).toBe(0);
        module.executeHook('onRegisterMetadata', context);
        expect(context.classes.length).toBe(1);

        module.executeHook('onGenerateTypes', {
            classMetadata: context.classes,
            methodMetadata: context.methods,
        });
        expect(context.classes.length).toBe(1);
        // Expect plugin to clear it own context due to it implementation
        expect(pluginContext.size).toBe(0);
    });
});
