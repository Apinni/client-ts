const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
};

export const PREFIX = `${colors.bold}${colors.cyan}[Apinni]${colors.reset}`;

export function fmtPath(p?: string) {
    return p ? `${colors.green}${p}${colors.reset}` : '';
}

export function line(length = 44) {
    return `${colors.cyan}${'─'.repeat(length)}${colors.reset}`;
}

export function logStartup(version: string) {
    console.log(line());
    console.log(
        `${colors.bold}${colors.cyan}🛠️  Apinni${colors.reset} | ${colors.green}TypeScript ${version}${colors.reset}`
    );
    console.log(line());
}

export function logWatchingStart() {
    console.log('');
    console.log(
        `${PREFIX} ▶ ${colors.bold}Watching for file changes${colors.reset} — press ${colors.bold}Ctrl+C${colors.reset} to exit.`
    );
    console.log('');
}

export function logEventStart(event: string, path?: string) {
    const icons: Record<string, string> = {
        add: '➕',
        change: '✏️ ',
        unlink: '🗑️ ',
        coldStart: '🚀',
    };
    const icon = icons[event] ?? 'ℹ️';
    console.log(
        `${PREFIX} ${icon} ${colors.bold}${event.toUpperCase()}${colors.reset} ${fmtPath(path)}`
    );
}

export function logEventComplete(
    event: string,
    path: string | undefined,
    durationSec: number,
    metaCount?: number
) {
    const messages: Record<string, string> = {
        coldStart: `Initialized with ${metaCount ?? 0} endpoints`,
        add: `New file analyzed`,
        change: `Changes processed`,
        unlink: `File removed`,
    };

    const msg = messages[event] ?? 'Done';
    console.log(
        `${PREFIX} ✅ ${msg} ${fmtPath(path)} ${colors.gray}(${durationSec.toFixed(2)}s)${colors.reset}`
    );
    console.log('');
}

export function logInfo(message: string) {
    console.log(`${PREFIX} ℹ  ${colors.dim}${message}${colors.reset}`);
}

export function logWarn(message: string) {
    console.warn(`${PREFIX} ⚠  ${colors.yellow}${message}${colors.reset}`);
}

export function logError(message: string) {
    console.error(`${PREFIX} ✖  ${colors.red}${message}${colors.reset}`);
}
