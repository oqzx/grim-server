export type Checksum = {
  algorithm: 'sha256' | 'sha1' | 'sha512';
  value: string;
};

export type Artifact = {
  name: string;
  url: string;
  version: string;
  sha256?: string;
  checksum?: Checksum;
  source: 'paper' | 'modrinth' | 'github';
  build?: number;
};

export type HttpClient = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type DiscoveryOptions = {
  fetch?: HttpClient;
  cacheDir?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};
