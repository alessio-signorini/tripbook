import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** True when the module at `metaUrl` is the script node was started with (not imported by a test). */
export const isMain = (metaUrl) => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(metaUrl);

/** Value after `--name` on the command line, or undefined. */
export function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export const flag = (name) => process.argv.includes(`--${name}`);

/** Run an async build; print only the message on failure and exit 1. */
export function run(promise) {
  promise.catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

export function usage(text) {
  console.error(`Usage: ${text}`);
  process.exit(2);
}
