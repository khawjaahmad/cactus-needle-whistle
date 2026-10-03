/*
 * A pinned model archive for the Node scripts: downloaded once into .ref/, then checked against
 * its SHA-256 on every run. The browser keeps the same archive in the Cache API instead
 * (src/runtime/engine-worker.js).
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const Models = require('../../src/runtime/models.js');

const CACHE_DIR = new URL('../../.ref/', import.meta.url);

/** The vendored Emscripten factory a pin pairs with. */
export const engineFor = (model) => require(`../../vendor/${model.engine}/needle.js`);

/** The archive's bytes, from .ref/ or downloaded there first. */
export async function weights(model) {
  const path = new URL(model.file, CACHE_DIR);
  if (!existsSync(path)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    process.stderr.write(`Downloading ${model.file} from ${model.revision.slice(0, 7)}…\n`);
    const response = await fetch(model.url);
    if (!response.ok) throw new Error(`Could not download ${model.file} (HTTP ${response.status}).`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  }
  const bytes = readFileSync(path);
  const hex = createHash('sha256').update(bytes).digest('hex');
  if (hex !== model.sha256) {
    throw new Error(`${model.file} failed its checksum (${hex}). Delete ${fileURLToPath(path)} and retry.`);
  }
  return bytes;
}
