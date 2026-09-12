import { createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGrim, resolvePaper } from '../src/artifacts.js';

const cache = path.resolve('.test-cache');

test.before(async () => {
  await mkdir(cache, { recursive: true });
});

test.after(async () => {
  await rm(cache, { recursive: true, force: true });
});

test('selects the newest stable Paper build and verifies its cache', async () => {
  const body = [
    {
      id: 2,
      channel: 'BETA',
      downloads: {
        'server:default': {
          name: 'paper-beta.jar',
          url: 'https://example.test/beta',
          checksums: { sha256: 'bad' },
        },
      },
    },
    {
      id: 1,
      channel: 'STABLE',
      downloads: {
        'server:default': {
          name: 'paper-stable.jar',
          url: 'https://example.test/stable',
          checksums: { sha256: digest('paper') },
        },
      },
    },
  ];
  const fetcher = async (url: string | URL): Promise<Response> => {
    if (String(url).endsWith('/builds')) return response(body);
    return response('paper');
  };
  const artifact = await resolvePaper('1.21.11', { fetch: fetcher, cacheDir: cache });
  assert.equal(artifact.build, 1);
  assert.equal(await readFile(artifact.path, 'utf8'), 'paper');
});

test('filters Grim versions by Minecraft compatibility and stable release type', async () => {
  const payload = [
    {
      version_number: '2.0.0-beta',
      version_type: 'beta',
      date_published: '2026-01-02T00:00:00Z',
      game_versions: ['1.21.11'],
      loaders: ['paper'],
      files: [
        { filename: 'grim-beta.jar', url: 'https://example.test/beta', primary: true, hashes: {} },
      ],
    },
    {
      version_number: '1.9.0',
      version_type: 'release',
      date_published: '2026-01-01T00:00:00Z',
      game_versions: ['1.21.11'],
      loaders: ['paper'],
      files: [
        {
          filename: 'grim.jar',
          url: 'https://example.test/grim',
          primary: true,
          hashes: { sha1: digest('grim', 'sha1') },
        },
      ],
    },
  ];
  const fetcher = async (url: string | URL): Promise<Response> => {
    if (String(url).includes('modrinth')) return response(payload);
    return response('grim');
  };
  const artifact = await resolveGrim('1.21.11', { fetch: fetcher, cacheDir: cache });
  assert.equal(artifact.version, '1.9.0');
  assert.equal(await readFile(artifact.path, 'utf8'), 'grim');
});

function response(value: unknown): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function digest(value: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
  return createHash(algorithm).update(value).digest('hex');
}
