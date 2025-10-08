import { DecoratorDefinition } from '@interfaces';
import { extractDecoratorArgValue } from '@utils';

import { DisabledOptions } from '../../../decorators';
import { GenerationContext } from '../../generation-context';

export const ApinniDisabledClassHandler: DecoratorDefinition<'class'>['handler'] =
    (event, { target, decorator }) => {
        if (event !== 'register') {
            return;
        }

        const context = GenerationContext.getInstance();

        const args = extractDecoratorArgValue<DisabledOptions>(decorator) || {
            disabled: true,
        };

        if ('domains' in args) {
            return context.registerClassMetadata(target, {
                disabledDomains: args.domains,
                disabledReason: args.reason,
            });
        }

        context.registerClassMetadata(target, {
            disabledDomains: {
                '*': args.disabled,
            },
            disabledReason: args.reason,
        });
    };

export const ApinniDisabledMethodHandler: DecoratorDefinition<'method'>['handler'] =
    (event, { target, propertyKey, decorator }) => {
        if (event !== 'register') {
            return;
        }

        const context = GenerationContext.getInstance();

        const args = extractDecoratorArgValue<DisabledOptions>(decorator) || {
            disabled: true,
        };

        if ('domains' in args) {
            return context.registerMethodMetadata(target, propertyKey, {
                disabledDomains: args.domains,
                disabledReason: args.reason,
            });
        }

        context.registerMethodMetadata(target, propertyKey, {
            disabledDomains: {
                '*': args.disabled,
            },
            disabledReason: args.reason,
        });
    };
