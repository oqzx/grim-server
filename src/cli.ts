#!/usr/bin/env node
import { writeDefaultConfig, loadConfig, configFileName } from './config.js';
import { listPaperVersions, resolveGrim, resolvePaper } from './artifacts/index.js';
import { startServer } from './server/index.js';

const [, , command, argument] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'init':
      console.log(`Created ${await writeDefaultConfig()}`);
      return;
    case 'versions': {
      console.log((await listPaperVersions()).join('\n'));
      return;
    }
    case 'verify': {
      const config = await loadConfig();
      const version = argument ?? config.version;
      const [paper, grim] = await Promise.all([
        resolvePaper(version, { cacheDir: config.cacheDir }),
        resolveGrim(version, { cacheDir: config.cacheDir }),
      ]);
      console.log(JSON.stringify({ paper, grim }, null, 2));
      return;
    }
    case 'start': {
      const config = await loadConfig();
      const server = await startServer(argument ? { ...config, version: argument } : config);
      const stopServer = (signal: NodeJS.Signals): void => {
        if (server.exitCode === null && !server.killed) server.kill(signal);
      };
      if (server.stdout) server.stdout.pipe(process.stdout);
      if (server.stderr) server.stderr.pipe(process.stderr);
      process.once('SIGINT', () => stopServer('SIGINT'));
      process.once('SIGTERM', () => stopServer('SIGTERM'));
      if (process.platform === 'win32') {
        process.once('SIGBREAK', () => stopServer('SIGBREAK'));
      }
      await new Promise<void>((resolve) => {
        server.once('close', (code) => {
          process.exitCode = code ?? 1;
          resolve();
        });
      });
      return;
    }
    default:
      throw new Error(
        `Usage: grim-server init | grim-server start [minecraft-version] | grim-server versions | grim-server verify [minecraft-version] (config: ${configFileName})`,
      );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
