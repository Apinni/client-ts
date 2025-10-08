import { beforeEach, describe, expect, it } from 'vitest';

import { ApinniConfig } from '@interfaces';

import { PluginManagerModule } from '../../plugin-manager';
import { MockRegistry } from '../services-mocks';
import {
    buildDependantPlugin,
    buildShareablePlugin,
    TestDecoratorName,
    TestShareableDecoratorName,
} from './mocks';

const createMockTarget = () => ({
    timestamp: Date.now(),
});

describe('SimplePlugin', () => {
    let registry: MockRegistry;

    let shareablePlugin: ReturnType<typeof buildShareablePlugin>['plugin'];
    let shareableContext: ReturnType<
        typeof buildShareablePlugin
    >['testContext'];

    let dependantPlugin: ReturnType<typeof buildDependantPlugin>['plugin'];
    let dependantContext: ReturnType<
        typeof buildDependantPlugin
    >['testContext'];
    let dependantTemporalContext: ReturnType<
        typeof buildDependantPlugin
    >['temporalContext'];

    let config: ApinniConfig;

    beforeEach(() => {
        registry = new MockRegistry();

        const { plugin: _shareablePlugin, testContext: _shareableContext } =
            buildShareablePlugin();
        [shareablePlugin, shareableContext] = [
            _shareablePlugin,
            _shareableContext,
        ];

        const {
            plugin: _dependantPlugin,
            testContext: _dependantContext,
            temporalContext: _dependantTemporalContext,
        } = buildDependantPlugin(shareablePlugin);
        [dependantPlugin, dependantContext, dependantTemporalContext] = [
            _dependantPlugin,
            _dependantContext,
            _dependantTemporalContext,
        ];

        config = {
            plugins: [dependantPlugin],
        } satisfies ApinniConfig;
    });

    it("should sort dependencies and correctly consume dependencies' contexts", () => {
        const module = new PluginManagerModule(config);

        module.executeHook('onInitialize', registry);
        expect(registry.decorators.size).toBe(2);

        const firstTarget = createMockTarget();
        const secondTarget = createMockTarget();
        const thirdTarget = createMockTarget();

        registry.trigger('register', TestDecoratorName, firstTarget);
        expect(shareableContext.get(firstTarget)).toBeUndefined();
        expect(dependantTemporalContext.get(firstTarget)).toBeDefined();

        registry.trigger('register', TestShareableDecoratorName, secondTarget);
        expect(shareableContext.get(secondTarget)).toBeDefined();
        expect(dependantTemporalContext.get(secondTarget)).toBeDefined();

        module.executeHook('onAfterDecoratorsProcessed');
        expect(shareableContext.get(thirdTarget)).toBeUndefined();
        expect(dependantTemporalContext.get(thirdTarget)).toBeUndefined();

        expect(dependantContext.get(firstTarget)).toBeUndefined();
        module.executeHook('onConsumeDependencyContexts');
        expect(dependantContext.get(firstTarget)).toBeDefined();

        expect(dependantContext.get(firstTarget)?.original).toBeDefined();
        expect(dependantContext.get(firstTarget)?.shared).toBeNull();

        expect(dependantContext.get(secondTarget)?.original).toBeDefined();
        expect(dependantContext.get(secondTarget)?.shared).toBeDefined();

        expect(dependantContext.get(thirdTarget)?.original).toBeUndefined();
        expect(dependantContext.get(thirdTarget)?.shared).toBeUndefined();
    });
});
