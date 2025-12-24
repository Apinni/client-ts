import { defineConfig } from 'tsup';

// All dependencies that should be external (not bundled)
const EXTERNAL_DEPS = [
    // Runtime dependencies
    'bundle-require',
    'commander',
    'listr2',
    'swagger-express-ts',
    'ts-morph',
    'chokidar',
    // Peer dependencies (must be installed by consumer)
    'reflect-metadata',
    'typescript',
    // Node.js built-ins
    'fs',
    'fs/promises',
    'path',
    'os',
    'util',
    'crypto',
    'stream',
    'events',
    // Build-time dependencies
    'esbuild',
    'esbuild-register',
    './transpilers/swc.js',
    // Regex patterns for deep imports
    /^bundle-require\//,
    /^swagger-express-ts\//,
];

export default defineConfig([
    // Main library entry point
    {
        entry: {
            index: 'src/index.ts',
        },
        format: ['cjs', 'esm'],
        dts: {
            resolve: true,
        },
        clean: true,
        splitting: false,
        treeshake: true,
        minify: true,
        sourcemap: true,
        target: 'node16',
        platform: 'node',
        outDir: 'dist',
        external: EXTERNAL_DEPS,
        outExtension({ format }) {
            return {
                js: format === 'cjs' ? '.js' : '.mjs',
            };
        },
        esbuildOptions(options) {
            options.charset = 'utf8';
        },
    },
    // CLI entry point
    {
        entry: {
            cli: 'src/cli.ts',
        },
        format: ['cjs', 'esm'],
        dts: false,
        clean: false,
        splitting: false,
        treeshake: true,
        minify: true,
        sourcemap: true,
        target: 'node16',
        platform: 'node',
        outDir: 'dist',
        external: EXTERNAL_DEPS,
        outExtension({ format }) {
            return {
                js: format === 'cjs' ? '.js' : '.mjs',
            };
        },
        esbuildOptions(options) {
            options.charset = 'utf8';
        },
    },
]);
