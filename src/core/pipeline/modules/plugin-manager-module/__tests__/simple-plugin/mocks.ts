import { OverridedContext } from '@interfaces';
import { buildPluginWithContext } from '@utils';

export type CustomContext = OverridedContext<{ custom_property: string }>;
const builder = buildPluginWithContext<CustomContext>();

export const TestDecoratorName = 'TestDecorator';

export const buildTestPlugin = () => {
    const testContext = new Map<any, string>();

    return {
        testContext,
        plugin: builder({
            name: 'TestPlugin',
            hooks: {
                onInitialize: registry =>
                    registry.register({
                        name: TestDecoratorName,
                        variant: 'class',
                        type: 'run-time',
                        handler: (event, params) => {
                            if (event === 'register') {
                                return testContext.set(
                                    params.target,
                                    'target_registered'
                                );
                            }

                            if (event === 'unregister') {
                                return testContext.delete(params.target);
                            }
                        },
                    }),
                onAfterDecoratorsProcessed: () => {
                    for (const key of testContext.keys()) {
                        const currentValue = testContext.get(key);

                        testContext.set(key, `${currentValue}_modified`);
                    }
                },
                onRegisterMetadata: context => {
                    for (const [target, value] of testContext.entries())
                        context.registerClassMetadata(target, {
                            custom_property: value,
                        });
                },
                onGenerateTypes: async ({ classMetadata }) => {
                    if (
                        classMetadata.find(meta =>
                            Boolean(meta.custom_property)
                        )
                    ) {
                        testContext.clear();
                    }
                },
            },
        }),
    };
};
