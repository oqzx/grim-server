# grim-server

A self-contained Minecraft server launcher for Paper + Grim anticheat.

## Features

- Downloads and caches Paper server jars and Grim anticheat jars automatically
- Bundles or resolves a Java runtime automatically across Linux, macOS, and Windows
- Creates and updates a local `grim-server.config.json` file for server settings
- Starts a server in a dedicated directory without removing worlds or config state
- Exposes a small library for programmatic server startup and artifact discovery

## Installation

```sh
npm install -g grim-server
```

## Quick start

```sh
mkdir my-server && cd my-server
grim-server init
grim-server start
```

This creates `grim-server.config.json` in the current directory and starts the configured server using the bundled runtime when available.

## Commands

```text
grim-server init
grim-server start [minecraft-version]
grim-server versions
grim-server verify [minecraft-version]
```

### `grim-server init`

Creates a default config file:

```json
{
  "version": "1.21.11",
  "serverDir": ".grim-server",
  "cacheDir": ".grim-cache",
  "port": 25565,
  "motd": "Grim Minecraft Server",
  "onlineMode": false,
  "allowFlight": true,
  "memory": {
    "min": "1G",
    "max": "2G"
  }
}
```

### `grim-server start [minecraft-version]`

Starts a Paper server with Grim enabled. If a version is provided, it overrides `config.version` for that run.

### `grim-server versions`

Lists available Paper versions from the upstream API.

### `grim-server verify [minecraft-version]`

Resolves the Paper and Grim artifacts for the selected version and prints their metadata.

## Configuration

`grim-server.config.json` lives next to the project root or the working directory used when launching the CLI. You can also pass partial overrides programmatically when calling the library.

### Supported fields

- `version`: Paper Minecraft version to use (for example `1.21.11`)
- `serverDir`: Directory that stores the server world and generated configs
- `cacheDir`: Directory used for downloaded jar artifacts
- `port`: Minecraft port, between `1` and `65535`
- `motd`: Server MOTD shown in the client
- `onlineMode`: Toggle Mojang authentication / online mode
- `allowFlight`: Allow flight in-game
- `memory.min`: Minimum Java heap size
- `memory.max`: Maximum Java heap size
- `serverProperties`: Any Minecraft `server.properties` key/value, including keys added by newer Minecraft or Paper versions
- `javaArgs`: Additional JVM arguments
- `environment`: Environment variables passed to the server process
- `captureOutput`: Capture child-process streams for programmatic logging
- `java`: Optional explicit Java executable or path override
- `paperJar`: Optional custom Paper jar path
- `grimJar`: Optional custom Grim jar path

### Example

```json
{
  "version": "1.21.7",
  "serverDir": "./worlds/dev",
  "cacheDir": "./.cache",
  "port": 25565,
  "motd": "Local Grim dev server",
  "onlineMode": false,
  "allowFlight": true,
  "serverProperties": {
    "difficulty": "hard",
    "gamemode": "survival",
    "view-distance": 10,
    "simulation-distance": 10,
    "spawn-protection": 0,
    "enable-command-block": true,
    "white-list": false
  },
  "javaArgs": ["-XX:+UseG1GC"],
  "environment": {
    "LANG": "en_US.UTF-8"
  },
  "captureOutput": true,
  "memory": {
    "min": "512M",
    "max": "1G"
  }
}
```

## Java and runtime resolution

Java is resolved in this order:

1. Explicit `java` config value
2. Bundled runtime in `.runtime/current` or a matching extracted JDK directory
3. `JAVA_HOME`
4. System `PATH`
5. Platform default Java command as a final fallback

This package is designed to be self-contained: it can bundle a JDK at publish/install time and use it automatically across Linux, macOS, and Windows without requiring a preinstalled Java runtime.

## Artifact discovery

Paper builds are discovered from the official Paper API, and Grim releases are resolved from Modrinth with GitHub releases as a fallback. Downloaded jars are cached locally and verified with published checksums before use.

## Library usage

```ts
import { startServer } from 'grim-server';

const server = await startServer({
  version: '1.21.11',
  port: 25565,
  motd: 'Local dev server',
  onlineMode: false,
});

server.on('close', (code) => {
  console.log(`server exited with code ${code}`);
});
```

The package also exports helpers for configuration, artifact cache management, Java resolution, and server startup.

The returned server handle is the underlying `ChildProcess` with convenience methods:

```ts
server.say('Server is ready');
server.command('weather clear');
server.stop();
server.killServer();
server.onLine((line) => console.log('[minecraft]', line));
server.onLog((line, stream) => console.log(`[${stream}]`, line));
server.on('exit', (code, signal) => console.log({ code, signal }));
server.on('error', (error) => console.error(error));
```

Unknown or future Minecraft/Paper properties are passed through unchanged. Existing files in
`serverDir` are preserved, and only the explicitly managed properties plus values in
`serverProperties` are updated.

## Development

```sh
npm install
npm run check
```

## License

Paper and Grim remain subject to their own licenses. This project is distributed under the MIT license.
