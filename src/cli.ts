#!/usr/bin/env node
import { program } from 'commander';

import { runApinni } from './index';
import { loadApinniConfig } from './load-config';

import 'reflect-metadata';

program
    .version('1.0.0')
    .description('Apinni CLI for generating types with decorators')
    .option(
        '-u, --use-existing-build',
        'use existing project build instead of building it'
    );

program
    .command('generate')
    .description('Generate types with decorators')
    .action(async () => {
        const { useExistingBuild } = program.opts();

        try {
            const config = await loadApinniConfig();
            await runApinni(config, {
                useExistingBuild,
                watch: false,
            });
        } catch (error) {
            console.error('Error:', (error as any).message);
            process.exit(1);
        }
    });

program
    .command('watch')
    .description('Run in watch mode for generating types with decorators')
    .action(async () => {
        try {
            const config = await loadApinniConfig();
            await runApinni(config, {
                watch: true,
            });
        } catch (error) {
            console.error('Error:', (error as any).message);
            process.exit(1);
        }
    });

program
    .exitOverride(err => {
        if (err.code === 'commander.unknownOption') {
            program.outputHelp();
        }
    })
    .parse(process.argv);
