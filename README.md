# boringcache/rust-action

Setup Rust and cache Cargo registry, `target`, and sccache artifacts with BoringCache.

Installs Rust via rustup, restores cached directories before your job runs, and saves them when it finishes. Caches are content-addressed — identical content is never re-uploaded.

## Quick start

```yaml
- uses: boringcache/rust-action@v1
  with:
    workspace: my-org/my-project
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}

- run: cargo build
- run: cargo test
```

## Mental model

This action caches the Rust directories you explicitly choose.

- Cargo registry and git dependencies are restored before your build.
- The `target` directory is restored to speed incremental compilation.
- Optional sccache support adds compiler-level caching.

This action does not infer what should be cached and does not modify your build commands.

Version detection order:
- `rust-toolchain.toml` (channel field)
- `rust-toolchain`
- `.tool-versions` (asdf/mise format)

If no version file is found, defaults to `stable`.

Cache tags:
- Cargo registry: `{cache-tag}-cargo-registry`
- Cargo git: `{cache-tag}-cargo-git`
- Target: `{cache-tag}-target-rust{major.minor}`
- sccache: `{cache-tag}-sccache-rust{major.minor}`

What gets cached:
- `~/.cargo/registry`
- `~/.cargo/git`
- `./target`
- `~/.cache/sccache` (or `$SCCACHE_DIR`)

## Common patterns

### Simple Rust CI cache

```yaml
- uses: boringcache/rust-action@v1
  with:
    workspace: my-org/my-project
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}

- run: cargo build --release
```

### Advanced pattern: Enable sccache

```yaml
- uses: boringcache/rust-action@v1
  with:
    workspace: my-org/my-project
    sccache: 'true'
    sccache-cache-size: 10G
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### With a specific Rust version

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-org/my-project
    rust-version: '1.75'
```

### With nightly Rust

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-org/my-project
    rust-version: nightly
```

### Without target caching

```yaml
- uses: boringcache/rust-action@v1
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
  with:
    workspace: my-org/my-project
    cache-target: 'false'
```

### Advanced pattern: Separate restore/save steps

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
    cargo-tag: ${{ steps.cache.outputs.cargo-tag }}
    target-tag: ${{ steps.cache.outputs.target-tag }}
    sccache-tag: ${{ steps.cache.outputs.sccache-tag }}
```

### Example GitHub workflow (with caching)

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
          workspace: my-org/my-project
          rust-version: stable
          working-directory: .

      - name: Build
        run: cargo build --release
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `cli-version` | No | `v1.3.0` | BoringCache CLI version. Set to `skip` to disable installation. |
| `workspace` | No | repo name | Workspace in `org/repo` form. Defaults to `BORINGCACHE_DEFAULT_WORKSPACE` or repo name. |
| `cache-tag` | No | repo name | Cache tag prefix used for cargo/target/sccache tags. |
| `rust-version` | No | auto-detected or `stable` | Rust version/channel to install. |
| `toolchain` | No | - | Alias for `rust-version` (dtolnay/rust-toolchain compatibility). |
| `targets` | No | - | Comma-separated target triples to install. |
| `components` | No | - | Comma-separated Rust components (e.g., `clippy,rustfmt`). |
| `profile` | No | `minimal` | Rustup profile: `minimal`, `default`, or `complete`. |
| `working-directory` | No | `.` | Project working directory. |
| `cache-cargo` | No | `true` | Cache cargo registry and git dependencies. |
| `cache-target` | No | `true` | Cache the `target` directory. |
| `sccache` | No | `false` | Enable sccache for compilation caching. |
| `sccache-cache-size` | No | `5G` | Maximum sccache cache size. |
| `exclude` | No | - | Glob pattern to exclude from cache digest (e.g., `*.out`). |
| `save-always` | No | `false` | Save cache even if the job fails. |

## Outputs

| Output | Description |
|--------|-------------|
| `workspace` | Resolved workspace name |
| `rust-version` | Installed Rust version |
| `cache-tag` | Cache tag prefix used |
| `cargo-tag` | Cache tag for cargo registry |
| `target-tag` | Cache tag for target directory |
| `sccache-tag` | Cache tag for sccache directory |
| `cache-hit` | Whether any cache was restored |
| `sccache-hit` | Whether sccache cache was restored |

## Platform behavior

Platform scoping is what makes it safe to reuse caches across machines.

Cargo registries are platform-agnostic, but `target` artifacts are platform-specific. This action keeps platform scoping enabled by default.

## Environment variables

| Variable | Description |
|----------|-------------|
| `BORINGCACHE_API_TOKEN` | API token for BoringCache authentication |
| `BORINGCACHE_DEFAULT_WORKSPACE` | Default workspace if not specified in inputs |
| `BORINGCACHE_INSTALLER_URL` | Override URL for the BoringCache installer script |
| `BORINGCACHE_INSTALLER_SHA256` | Expected SHA256 of the installer script (recommended for integrity) |

## Troubleshooting

- Cache miss on first run is expected.
- Cargo git cache is skipped when your `Cargo.lock` has no git dependencies.
- sccache caches only when compilation happens and the server is running.

## Release notes

See https://github.com/boringcache/rust-action/releases.

## License

MIT
