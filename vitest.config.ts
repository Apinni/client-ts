import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
        },
    },
    resolve: {
        alias: {
            '@utils': path.resolve(__dirname, './src/utils'),
        },
    },
});
