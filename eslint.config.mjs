import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{js,ts}'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'simple-import-sort': simpleImportSortPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            ...prettierPlugin.configs.recommended.rules,
            'prettier/prettier': [
                'error',
                {},
                { file: 'configs/prettier.config.mjs' },
            ],
            'prefer-const': 'error',

            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/ban-types': 'off',

            'simple-import-sort/imports': [
                'error',
                {
                    groups: [
                        ['^[a-z]'],
                        ['^@interfaces', '@utils'],
                        ['^\\.\\.', '^\\./'],
                    ],
                },
            ],
            'simple-import-sort/exports': 'error',
        },
    },
    {
        ignores: ['dist', 'node_modules', 'build', 'docs'],
    },
];
