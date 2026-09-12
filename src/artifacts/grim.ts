import { cacheArtifact } from './cache.js';
import { requestJson } from './http.js';
import type { Artifact, DiscoveryOptions } from './types.js';

export async function resolveGrim(
  minecraftVersion: string,
  options: DiscoveryOptions = {},
): Promise<Artifact> {
  let modrinthError: unknown;
  try {
    const versions = await requestJson(
      `https://api.modrinth.com/v2/project/grimac/version?game_versions=${encodeURIComponent(JSON.stringify([minecraftVersion]))}`,
      options,
    );
    if (!Array.isArray(versions)) {
      throw new Error('Modrinth discovery returned an invalid response');
    }
    const selected = versions
      .filter((value): value is ModrinthVersion => isModrinthVersion(value, minecraftVersion))
      .sort(compareModrinthVersions)[0];
    const file =
      selected?.files.find((entry) => entry.primary && /\.jar$/i.test(entry.filename)) ??
      selected?.files.find((entry) => /\.jar$/i.test(entry.filename));
    if (selected && file?.url) {
      const checksum = file.hashes.sha512
        ? { algorithm: 'sha512' as const, value: file.hashes.sha512 }
        : file.hashes.sha1
          ? { algorithm: 'sha1' as const, value: file.hashes.sha1 }
          : undefined;
      const artifact: Artifact = {
        name: file.filename,
        url: file.url,
        version: selected.version_number,
        source: 'modrinth',
        ...(checksum ? { checksum } : {}),
      };
      return options.cacheDir ? cacheArtifact(artifact, options.cacheDir, options) : artifact;
    }
  } catch (error) {
    modrinthError = error;
  }
  try {
    const releases = await requestJson(
      'https://api.github.com/repos/GrimAnticheat/Grim/releases?per_page=30',
      { ...options, headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!Array.isArray(releases)) {
      throw new Error('GitHub release discovery returned an invalid response');
    }
    const release = releases.find((value): value is GithubRelease =>
      isGithubRelease(value, minecraftVersion),
    );
    const asset = release && githubAsset(release);
    if (!asset) {
      throw new Error(`No Grim release asset is compatible with Minecraft ${minecraftVersion}`);
    }
    const artifact: Artifact = {
      name: asset.name,
      url: asset.browser_download_url,
      version: typeof release.tag_name === 'string' ? release.tag_name : minecraftVersion,
      source: 'github',
      ...(asset.digest?.startsWith('sha256:')
        ? { sha256: asset.digest.slice('sha256:'.length).toLowerCase() }
        : {}),
    };
    return options.cacheDir ? cacheArtifact(artifact, options.cacheDir, options) : artifact;
  } catch (fallbackError) {
    const reason = modrinthError instanceof Error ? ` Modrinth: ${modrinthError.message}.` : '';
    throw new Error(
      `Unable to discover Grim for Minecraft ${minecraftVersion}.${reason} GitHub: ${
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      }`,
    );
  }
}

type ModrinthFile = {
  filename: string;
  url: string;
  primary?: boolean;
  hashes: { sha1?: string; sha512?: string };
};

type ModrinthVersion = {
  version_number: string;
  version_type: string;
  date_published: string;
  game_versions: string[];
  loaders: string[];
  files: ModrinthFile[];
};

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
  digest?: string;
};

type GithubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: GithubAsset[];
};

function isModrinthVersion(value: unknown, minecraftVersion: string): value is ModrinthVersion {
  if (!value || typeof value !== 'object') return false;
  const version = value as Partial<ModrinthVersion>;
  return (
    typeof version.version_number === 'string' &&
    typeof version.version_type === 'string' &&
    typeof version.date_published === 'string' &&
    Array.isArray(version.game_versions) &&
    version.game_versions.includes(minecraftVersion) &&
    Array.isArray(version.loaders) &&
    version.loaders.some((loader) =>
      ['paper', 'bukkit', 'spigot'].includes(loader.toLowerCase()),
    ) &&
    Array.isArray(version.files)
  );
}

function compareModrinthVersions(a: ModrinthVersion, b: ModrinthVersion): number {
  const rank = (type: string) => (type === 'release' ? 0 : type === 'beta' ? 1 : 2);
  return (
    rank(a.version_type) - rank(b.version_type) ||
    Date.parse(b.date_published) - Date.parse(a.date_published)
  );
}

function isGithubRelease(value: unknown, version: string): value is GithubRelease {
  if (!value || typeof value !== 'object') return false;
  const release = value as Partial<GithubRelease>;
  const text = `${release.tag_name ?? ''} ${release.name ?? ''} ${release.body ?? ''}`;
  return (
    release.draft !== true &&
    release.prerelease !== true &&
    Array.isArray(release.assets) &&
    text.includes(version)
  );
}

function githubAsset(release: GithubRelease): GithubAsset | undefined {
  return release.assets.find(
    (asset) =>
      typeof asset.name === 'string' &&
      /\.jar$/i.test(asset.name) &&
      typeof asset.browser_download_url === 'string' &&
      (asset.size === undefined || asset.size > 0),
  );
}
