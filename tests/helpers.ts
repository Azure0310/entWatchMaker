import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return path.join(here, 'fixtures', name);
}

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath(name)));
}

export function fixtureText(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}
