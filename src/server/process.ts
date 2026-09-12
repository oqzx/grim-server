import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { ServerHandle } from './types.js';

export function enhanceProcess(child: ChildProcess): ServerHandle {
  const lines = new EventEmitter();
  const logs = new EventEmitter();
  consume(child.stdout, 'stdout', lines, logs);
  consume(child.stderr, 'stderr', lines, logs);

  const handle = child as ServerHandle;
  handle.command = (input) => {
    if (!child.stdin || child.stdin.destroyed) return false;
    child.stdin.write(`${input.trim()}\n`);
    return true;
  };
  handle.say = (message) => handle.command(`say ${message}`);
  handle.stop = () => handle.command('stop');
  handle.killServer = () => child.kill();
  handle.onLine = (listener) => {
    lines.on('line', listener);
    return handle;
  };
  handle.onLog = (listener) => {
    logs.on('log', listener);
    return handle;
  };
  return handle;
}

function consume(
  stream: NodeJS.ReadableStream | null,
  channel: 'stdout' | 'stderr',
  lines: EventEmitter,
  logs: EventEmitter,
): void {
  if (!stream) return;
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    pending += chunk;
    const complete = pending.split(/\r?\n/);
    pending = complete.pop() ?? '';
    for (const line of complete) emit(line);
  });
  stream.on('end', () => {
    if (pending) emit(pending);
  });

  function emit(line: string): void {
    lines.emit('line', line);
    logs.emit('log', line, channel);
  }
}
