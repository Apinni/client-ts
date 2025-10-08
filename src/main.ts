import { ApinniConfig } from '@interfaces';

import { PipelineOptions } from './core/pipeline';
import { Pipeline, Watcher } from './core/pipeline';

export async function runApinni(
    config: ApinniConfig,
    options: PipelineOptions
): Promise<void> {
    const runner = options.watch
        ? new Watcher(config)
        : new Pipeline(config, options);

    await runner.run();
}

export type {
    ApinniConfig,
    ClassMetadata,
    IGenerationContext,
    MethodMetadata,
    OverridedContext,
} from '@interfaces';
export * from '@interfaces/plugins';
