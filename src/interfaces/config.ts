import { PluginTypes } from './plugins';

export interface ApinniConfig {
    includePatterns?: string[];
    excludePattenrs?: string[];
    plugins: PluginTypes[];
    outputPath?: string;
    generateSchemaFiles?: boolean;
}

export type ApinniRunMode = 'watch' | 'default';
