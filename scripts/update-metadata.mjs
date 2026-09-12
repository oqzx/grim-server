import { mkdir, writeFile } from 'node:fs/promises';

const paper = await fetch('https://fill.papermc.io/v3/projects/paper').then((response) => {
  if (!response.ok) throw new Error(`Paper API returned HTTP ${response.status}`);
  return response.json();
});
const grim = await fetch('https://api.modrinth.com/v2/project/grimac/version?limit=100').then(
  (response) => {
    if (!response.ok) throw new Error(`Modrinth API returned HTTP ${response.status}`);
    return response.json();
  },
);
await mkdir('metadata', { recursive: true });
await writeFile(
  'metadata/paper.json',
  `${JSON.stringify({ updatedAt: new Date().toISOString(), versions: paper.versions ?? {} }, null, 2)}\n`,
);
await writeFile(
  'metadata/grim.json',
  `${JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      releases: Array.isArray(grim)
        ? grim.map(({ id, version_number, version_type, game_versions, date_published }) => ({
            id,
            version_number,
            version_type,
            game_versions,
            date_published,
          }))
        : [],
    },
    null,
    2,
  )}\n`,
);
