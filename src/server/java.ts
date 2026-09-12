import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function resolveJava(configured?: string): Promise<string> {
  if (configured) return configured;
  const bundled = await findBundledJava();
  if (bundled) return bundled;
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const candidate = path.join(javaHome, 'bin', executableName());
    if (await isFile(candidate)) return candidate;
  }
  const pathJava = await findJavaOnPath();
  return pathJava ?? executableName();
}

async function findJavaOnPath(): Promise<string | undefined> {
  const pathValue = process.env.PATH;
  if (!pathValue) return undefined;
  for (const directory of pathValue.split(path.delimiter)) {
    const candidate = path.join(directory, executableName());
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

async function findBundledJava(): Promise<string | undefined> {
  const roots = [
    path.resolve('.runtime'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.runtime'),
  ];
  for (const root of roots) {
    const entries = await directories(root);
    for (const entry of entries) {
      const candidates = [
        path.join(root, entry, 'bin', executableName()),
        path.join(root, entry, 'current', 'bin', executableName()),
        path.join(root, 'current', 'bin', executableName()),
      ];
      for (const candidate of candidates) {
        if (await isFile(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

async function directories(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function executableName(): string {
  return os.platform() === 'win32' ? 'java.exe' : 'java';
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
