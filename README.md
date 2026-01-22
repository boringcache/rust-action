# boringcache/rust-action

**Cache once. Reuse everywhere.**

A GitHub Action to setup Rust via rustup and cache Rust, cargo, and target directory via BoringCache.

## Why BoringCache

- Manifest-aware reuse (repeat saves upload **0 bytes** when unchanged)
- Verified restores (integrity checked before extraction)
- Platform-aware safety (OS/arch suffixing by default)
- Unlimited authenticated restores (no egress fees)

## Quick Start

```yaml
- uses: boringcache/rust-action@v1
  with:
    workspace: my-org/my-project
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}

- run: cargo build
- run: cargo test
```

Cache is automatically restored before setup and saved after the job.

## Separate Actions (Advanced)

For granular control, use the restore and save sub-actions separately:

```yaml
- uses: boringcache/rust-action/restore@v1
  id: cache
  with:
    workspace: my-org/my-project
    rust-version: stable

- run: cargo build --release

- uses: boringcache/rust-action/save@v1
  with:
    workspace: my-org/my-project
    rust-tag: ${{ steps.cache.outputs.rust-tag }}
    cargo-tag: ${{ steps.cache.outputs.cargo-tag }}
    target-tag: ${{ steps.cache.outputs.target-tag }}
```

## Features

- Installs Rust via rustup for consistent version management
- Caches Rust toolchain installation
- Caches cargo registry and git dependencies
- Caches target directory for faster incremental builds
- Auto-detects Rust version from `rust-toolchain.toml`, `rust-toolchain`, or `.tool-versions`
- Automatic post-job cache saving

## Usage

### With specific Rust version

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-cache
    rust-version: '1.75'
```

### With nightly Rust

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-cache
    rust-version: nightly
```

### Without target caching

For projects where target caching doesn't help:

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-cache
    cache-target: 'false'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workspace` | BoringCache workspace | Yes* | - |
| `cache-tag` | Cache tag prefix (defaults to repo name) | No | - |
| `rust-version` | Rust version/channel to install | No | Auto-detected or `stable` |
| `working-directory` | Project working directory | No | `.` |
| `cache-rust` | Cache Rust installation | No | `true` |
| `cache-cargo` | Cache cargo registry and git | No | `true` |
| `cache-target` | Cache target directory | No | `true` |
| `exclude` | Glob pattern to exclude from cache digest | No | - |
| `save-always` | Save cache even if job fails | No | `false` |

*Required unless `BORINGCACHE_DEFAULT_WORKSPACE` is set.

## Example GitHub Workflow (with caching)

```yaml
name: Rust Build (BoringCache)

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust + caches via BoringCache
        uses: boringcache/rust-action@v1
        with:
          workspace: my-cache # or set BORINGCACHE_DEFAULT_WORKSPACE
          rust-version: stable
          working-directory: .

      - name: Build
        run: cargo build --release
```

## Version Detection

The action automatically detects the Rust version from these files (in order):

1. `rust-toolchain.toml` (channel field)
2. `rust-toolchain` (legacy format)
3. `.tool-versions` (asdf/mise format)

If no version file is found, defaults to `stable`.

## Cache Tags

BoringCache is content-addressed, so tags identify what to restore (no hash needed in tags). The action creates cache tags with the format:

- **Rust**: `{cache-tag}-rust-{version}`
- **Cargo Registry**: `{cache-tag}-cargo-registry`
- **Cargo Git**: `{cache-tag}-cargo-git`
- **Target**: `{cache-tag}-target`

The `cache-tag` prefix defaults to the repository name from `GITHUB_REPOSITORY`.

## What Gets Cached

- **Rust toolchain**: The rustup-installed Rust compiler and tools
- **Cargo registry**: `~/.cargo/registry` - downloaded crate sources
- **Cargo git**: `~/.cargo/git` - git dependencies
- **Target directory**: `./target` - build artifacts for incremental compilation

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BORINGCACHE_API_TOKEN` | API token for BoringCache authentication |
| `BORINGCACHE_DEFAULT_WORKSPACE` | Default workspace if not specified in inputs |
| `BORINGCACHE_INSTALLER_URL` | Override URL for downloading the BoringCache installer script |
| `BORINGCACHE_INSTALLER_SHA256` | Expected SHA256 of the BoringCache installer script; recommended to enable checksum verification |

> For workflows with elevated privileges or sensitive secrets, provide `BORINGCACHE_INSTALLER_SHA256` to enforce installer integrity.

## Release Notes

See https://github.com/boringcache/rust-action/releases.

## License

MIT
