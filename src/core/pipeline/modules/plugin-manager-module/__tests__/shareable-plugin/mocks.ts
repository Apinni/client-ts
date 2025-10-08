import { buildPlugin } from '@utils';

export const TestShareableDecoratorName = 'TestShareableDecorator';

export const buildShareablePlugin = () => {
    const testContext = new Map<
        any,
        {
            sharedProperty: string;
        }
    >();

    const plugin = buildPlugin({
        name: 'TestShareablePlugin',
        config: {
            shareable: true,
        },
        hooks: {
            onInitialize: registry => {
                registry.register({
                    name: TestShareableDecoratorName,
                    type: 'compile-time',
                    variant: 'class',
                    handler: (_, params) => {
                        testContext.set(params.target, {
                            sharedProperty: 'test',
                        });
                    },
                });
            },
            onProvideSharedContext: () => ({
                data: testContext,
            }),
        },
    });

    return { testContext, plugin };
};

export const TestDecoratorName = 'TestDecorator';

export const buildDependantPlugin = (
    shareablePlugin: ReturnType<typeof buildShareablePlugin>['plugin']
) => {
    const temporalContext = new Map<any, string>();
    const testContext = new Map<
        any,
        {
            original: string;
            shared: string | null;
        }
    >();

    return {
        temporalContext,
        testContext,
        plugin: buildPlugin({
            name: 'TestDependantPlugin',
            config: {
                shareable: false,
            },
            dependencies: [
                {
                    plugin: shareablePlugin,
                },
            ],
            hooks: {
                onInitialize: registry =>
                    [TestDecoratorName, TestShareableDecoratorName].map(
                        decoratorName =>
                            registry.register({
                                name: decoratorName,
                                type: 'compile-time',
                                variant: 'class',
                                handler: (event, params) => {
                                    if (event === 'register') {
                                        return temporalContext.set(
                                            params.target,
                                            'registered'
                                        );
                                    }
                                },
                            })
                    ),
                onConsumeDependencyContexts([sharedContext]) {
                    for (const [target, value] of temporalContext.entries()) {
                        const sharedContextValue =
                            sharedContext.data.get(target);

                        testContext.set(target, {
                            original: value,
                            shared: sharedContextValue?.sharedProperty ?? null,
                        });
                    }
                },
            },
        }),
    };
};
