import { buildPlugin } from '@utils';

import { CONTROLLER_DECORATORS, ENDPOINT_DECORATORS } from './constants';
import { ApiOperationHandler, ApiPathHandler, finalize } from './processor';

const SwaggerPlugin = buildPlugin({
    name: 'Swagger Plugin',
    hooks: {
        onInitialize: registry => {
            CONTROLLER_DECORATORS.map(decorator =>
                registry.register({
                    name: decorator,
                    variant: 'class',
                    type: 'compile-time',
                    handler: ApiPathHandler,
                })
            );

            ENDPOINT_DECORATORS.map(decorator =>
                registry.register({
                    name: decorator,
                    variant: 'method',
                    type: 'compile-time',
                    handler: ApiOperationHandler,
                })
            );
        },
        onRegisterMetadata: context => {
            finalize(context);
        },
    },
});

export default SwaggerPlugin;
