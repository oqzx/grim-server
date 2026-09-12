import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeConfig } from '../src/config.js';

test('normalizes paths and preserves a configured Java command', () => {
  const config = normalizeConfig(
    { serverDir: 'world', java: 'java17', port: 25570 },
    'C:\\project',
  );
  assert.equal(config.serverDir, 'C:\\project\\world');
  assert.equal(config.java, 'java17');
  assert.equal(config.port, 25570);
});

test('accepts Windows-style absolute paths on any platform', () => {
  const config = normalizeConfig(
    {
      serverDir: 'C:\\servers\\grim-server',
      cacheDir: 'C:\\servers\\grim-cache',
      java: 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      paperJar: 'C:\\downloads\\paper.jar',
      grimJar: 'C:\\downloads\\grim.jar',
    },
    '/tmp/project',
  );

  assert.equal(config.serverDir, 'C:\\servers\\grim-server');
  assert.equal(config.cacheDir, 'C:\\servers\\grim-cache');
  assert.equal(config.java, 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe');
  assert.equal(config.paperJar, 'C:\\downloads\\paper.jar');
  assert.equal(config.grimJar, 'C:\\downloads\\grim.jar');
});

test('preserves arbitrary Minecraft properties and process settings', () => {
  const config = normalizeConfig({
    serverProperties: {
      difficulty: 'hard',
      'simulation-distance': 12,
      'enable-command-block': true,
    },
    javaArgs: ['-XX:+UseG1GC'],
    environment: { LANG: 'en_US.UTF-8' },
    captureOutput: false,
  });

  assert.deepEqual(config.serverProperties, {
    difficulty: 'hard',
    'simulation-distance': 12,
    'enable-command-block': true,
  });
  assert.deepEqual(config.javaArgs, ['-XX:+UseG1GC']);
  assert.deepEqual(config.environment, { LANG: 'en_US.UTF-8' });
  assert.equal(config.captureOutput, false);
});

test('rejects invalid ports and versions', () => {
  assert.throws(() => normalizeConfig({ port: 0 }));
  assert.throws(() => normalizeConfig({ version: '../unsafe' }));
});
