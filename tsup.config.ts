import { defineConfig } from 'tsup';

export default defineConfig([
    {
        entry: ['src/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        clean: true,
        minify: true,
        target: 'esnext',
        outDir: 'dist',
        external: [
            'esbuild-register',
            'fs',
            'path',
            'esbuild',
            'typescript',
            './transpilers/swc.js',
            'listr2',
        ],
    },
    {
        entry: ['src/cli.ts'],
        format: ['cjs', 'esm'],
        dts: false,
        clean: true,
        minify: true,
        target: 'esnext',
        outDir: 'dist',
        external: [
            'esbuild-register',
            'fs',
            'path',
            'esbuild',
            'typescript',
            './transpilers/swc.js',
            './index',
            'listr2',
        ],
    },
]);
