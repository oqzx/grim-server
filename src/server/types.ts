import type { ChildProcess } from 'node:child_process';
import type { Artifact, HttpClient } from '../artifacts/index.js';

export type LaunchOptions = {
  fetch?: HttpClient;
  signal?: AbortSignal;
};

export type ServerHandle = ChildProcess & {
  command(input: string): boolean;
  say(message: string): boolean;
  stop(): boolean;
  killServer(): boolean;
  onLine(listener: (line: string) => void): ServerHandle;
  onLog(listener: (line: string, stream: 'stdout' | 'stderr') => void): ServerHandle;
};

export type ResolvedArtifact = Artifact & { path: string };
