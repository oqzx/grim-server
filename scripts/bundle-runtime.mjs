import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tar from 'tar';
import extractZip from 'extract-zip';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimeRoot = path.resolve(root, '.runtime');
const platform = process.platform;
const architecture = process.arch === 'arm64' ? 'aarch64' : 'x64';
const platformName = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux';
const archiveFile = path.join(runtimeRoot, `jdk-${platformName}-${architecture}.download`);

await mkdir(runtimeRoot, { recursive: true });
await rm(path.join(runtimeRoot, 'current'), { recursive: true, force: true });
await rm(archiveFile, { force: true });

const binaryUrl = `https://api.adoptium.net/v3/binary/latest/21/ga/${platformName}/${architecture}/jdk/hotspot/normal/eclipse`;
const response = await fetch(binaryUrl, { redirect: 'follow' });
if (!response.ok || !response.body) {
  throw new Error(`Unable to download the bundled Java runtime (${response.status})`);
}

const archiveStream = createWriteStream(archiveFile);
await pipeline(response.body, archiveStream);

if (platform === 'win32') {
  await extractZip(archiveFile, { dir: runtimeRoot });
} else {
  await tar.x({ file: archiveFile, cwd: runtimeRoot, preservePaths: true });
}

await rm(archiveFile, { force: true });
const extracted = await readdir(runtimeRoot, { withFileTypes: true });
const javaHomeEntry = extracted.find(
  (entry) => entry.isDirectory() && /jdk|java/i.test(entry.name),
);
if (!javaHomeEntry) {
  throw new Error(
    `Bundled Java runtime was downloaded but not extracted as expected in ${runtimeRoot}`,
  );
}

const actualJavaHome = path.join(runtimeRoot, javaHomeEntry.name);
const runtimeLink = path.join(runtimeRoot, 'current');
try {
  await import('node:fs/promises').then(({ symlink, unlink }) => {
    return unlink(runtimeLink)
      .catch(() => undefined)
      .then(() => symlink(actualJavaHome, runtimeLink, 'junction'));
  });
} catch {
  await import('node:fs/promises').then(({ symlink, unlink }) => {
    return unlink(runtimeLink)
      .catch(() => undefined)
      .then(() => symlink(actualJavaHome, runtimeLink, 'dir'));
  });
}

await writeFile(
  path.join(runtimeRoot, 'runtime.json'),
  JSON.stringify({ platform: platformName, architecture, javaHome: actualJavaHome }, null, 2) +
    '\n',
);

console.log(`Bundled Java runtime ready at ${actualJavaHome}`);
