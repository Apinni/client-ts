import { DecoratorDefinition } from '@interfaces';
import { extractDecoratorArgValue } from '@utils';

import { DomainOptions } from '../../../decorators';
import { GenerationContext } from '../../generation-context';

export const ApinniDomainHandler: DecoratorDefinition<'class'>['handler'] = (
    event,
    { target, decorator }
) => {
    if (event !== 'register') {
        return;
    }

    const context = GenerationContext.getInstance();

    const args = extractDecoratorArgValue<DomainOptions>(decorator);

    context.registerClassMetadata(target, {
        ...(args && {
            domains: Array.isArray(args.domains)
                ? args.domains
                : [args.domains],
        }),
    });
};
