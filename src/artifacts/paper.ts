import { cacheArtifact } from './cache.js';
import { requestJson } from './http.js';
import type { Artifact, DiscoveryOptions } from './types.js';

export async function listPaperVersions(options: DiscoveryOptions = {}): Promise<string[]> {
  const response = await requestJson('https://fill.papermc.io/v3/projects/paper', options);
  if (!response || typeof response !== 'object') {
    throw new Error('Paper version discovery returned an invalid response');
  }
  const versions = (response as { versions?: unknown }).versions;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) {
    throw new Error('Paper version discovery returned an invalid response');
  }
  return Object.values(versions).flatMap((value) =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [],
  );
}

export async function resolvePaper(
  version: string,
  options: DiscoveryOptions = {},
): Promise<Artifact> {
  if (version === 'latest') {
    const available = await listPaperVersions(options);
    const selected = available[0];
    if (!selected) throw new Error('Paper discovery returned no versions');
    version = selected;
  }
  const response = await requestJson(
    `https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(version)}/builds`,
    options,
  );
  if (!Array.isArray(response)) throw new Error('Paper discovery returned an invalid response');
  const builds = response.filter(isPaperBuild);
  if (builds.length === 0) {
    throw new Error(`No Paper builds are available for Minecraft ${version}`);
  }
  const stable = builds.filter((build) => build.channel.toUpperCase() === 'STABLE');
  const selected = [...(stable.length > 0 ? stable : builds)].sort((a, b) => b.id - a.id)[0];
  if (!selected) throw new Error(`No usable Paper build is available for Minecraft ${version}`);
  const download = selected.downloads['server:default'];
  const artifact: Artifact = {
    name: download.name,
    url: download.url,
    version,
    sha256: download.checksums.sha256.toLowerCase(),
    source: 'paper',
    build: selected.id,
  };
  return options.cacheDir ? cacheArtifact(artifact, options.cacheDir, options) : artifact;
}

type PaperBuild = {
  id: number;
  channel: string;
  downloads: {
    'server:default': {
      name: string;
      url: string;
      checksums: { sha256: string };
    };
  };
};

function isPaperBuild(value: unknown): value is PaperBuild {
  if (!value || typeof value !== 'object') return false;
  const build = value as Partial<PaperBuild>;
  const download = build.downloads?.['server:default'];
  return (
    Number.isInteger(build.id) &&
    typeof build.channel === 'string' &&
    !!download &&
    typeof download.name === 'string' &&
    typeof download.url === 'string' &&
    typeof download.checksums?.sha256 === 'string'
  );
}
