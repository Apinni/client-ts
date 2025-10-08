import { DecoratorDefinition } from '@interfaces';
import { extractDecoratorArgValue } from '@utils';

import { ControllerOptions } from '../../../decorators';
import { GenerationContext } from '../../generation-context';

export const ApinniControllerHandler: DecoratorDefinition<'class'>['handler'] =
    (event, { target, decorator }) => {
        if (event !== 'register') {
            return;
        }

        const context = GenerationContext.getInstance();

        const args = extractDecoratorArgValue<ControllerOptions>(decorator);

        context.registerClassMetadata(target, {
            ...args,
        });
    };
