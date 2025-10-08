import { bundleRequire } from 'bundle-require';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_CONFIGS = [
    'apinni.config.ts',
    'apinni.config.js',
    'apinni.config.mjs',
    'apinni.config.cjs',
];

export async function loadApinniConfig(cwd: string = process.cwd()) {
    for (const file of SUPPORTED_CONFIGS) {
        const absPath = path.join(cwd, file);
        if (fs.existsSync(absPath)) {
            const { mod } = await bundleRequire({
                filepath: absPath,
            });

            return mod.default || mod;
        }
    }

    throw new Error(
        'No apinni.config.ts, .js, cjs or .mjs found in project root'
    );
}
