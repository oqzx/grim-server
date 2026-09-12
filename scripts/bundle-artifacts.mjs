import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const minecraftVersion = process.env.GRIM_MINECRAFT_VERSION ?? '1.21.11';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(root, 'vendor');
const userAgent = 'grim-server release bundler';

const response = await fetch(
  `https://api.modrinth.com/v2/project/grimac/version?game_versions=${encodeURIComponent(JSON.stringify([minecraftVersion]))}`,
  { headers: { 'User-Agent': userAgent } },
);
if (!response.ok) throw new Error(`Modrinth API returned HTTP ${response.status}`);

const versions = await response.json();
if (!Array.isArray(versions)) throw new Error('Modrinth returned an invalid version list');

const version = versions
  .filter(
    (entry) =>
      entry?.status === 'listed' &&
      entry?.version_type === 'release' &&
      Array.isArray(entry.game_versions) &&
      entry.game_versions.includes(minecraftVersion) &&
      Array.isArray(entry.loaders) &&
      entry.loaders.some((loader) => ['paper', 'bukkit', 'spigot'].includes(loader)),
  )
  .sort((left, right) => Date.parse(right.date_published) - Date.parse(left.date_published))[0];
const file = version?.files?.find((entry) => entry.primary && entry.filename.endsWith('.jar'));
if (!version || !file?.url) {
  throw new Error(`No stable Grim release is available for Minecraft ${minecraftVersion}`);
}

const artifact = await fetch(file.url, { headers: { 'User-Agent': userAgent } });
if (!artifact.ok || !artifact.body)
  throw new Error(`Grim download returned HTTP ${artifact.status}`);

const bytes = Buffer.from(await artifact.arrayBuffer());
const algorithm = file.hashes.sha512 ? 'sha512' : 'sha1';
const expected = file.hashes[algorithm];
const actual = createHash(algorithm).update(bytes).digest('hex');
if (!expected || actual !== expected)
  throw new Error(`Grim ${algorithm} checksum verification failed`);

await mkdir(output, { recursive: true });
const target = path.join(output, file.filename);
const temporary = `${target}.part`;
await rm(temporary, { force: true });
await writeFile(temporary, bytes);
await rename(temporary, target);
await writeFile(
  path.join(output, 'grim.json'),
  `${JSON.stringify(
    {
      minecraftVersion,
      version: version.version_number,
      filename: file.filename,
      source: file.url,
      checksum: { algorithm, value: expected },
    },
    null,
    2,
  )}\n`,
);
console.log(`Bundled Grim ${version.version_number} for Minecraft ${minecraftVersion}`);
