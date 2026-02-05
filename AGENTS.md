# BoringCache Rust

## What It Does

Sets up Rust toolchain via mise and caches:
- Rust installation
- Cargo registry (`~/.cargo/registry`)
- Cargo git dependencies (`~/.cargo/git`)
- Target directory (`target/`)

## Quick Reference

```yaml
- uses: boringcache/rust@v1
  with:
    workspace: my-org/my-project
    rust-version: stable
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## How It Works

1. **Restore phase**:
   - Restores cached Rust installation, cargo registry, and target directory
   - Installs mise (if needed)
   - Installs Rust via mise
   - Sets up PATH and CARGO_HOME

2. **Save phase**:
   - Saves Rust installation, cargo registry, and target directory

## Cache Tags

Uses `cache-tag` prefix (defaults to repository name) with suffixes:
- `{prefix}-rust-{version}` - Rust toolchain
- `{prefix}-cargo-registry` - Cargo registry cache
- `{prefix}-cargo-git` - Cargo git dependencies
- `{prefix}-target` - Compiled artifacts

## Version Detection

Auto-detects version from (in order):
1. `rust-version` input
2. `rust-toolchain.toml`
3. `rust-toolchain`
4. `.tool-versions`

## Inputs

| Input | Description |
|-------|-------------|
| `workspace` | BoringCache workspace |
| `rust-version` | Rust version (e.g., `stable`, `1.75.0`) |
| `cache-tag` | Cache tag prefix (defaults to repo name) |
| `components` | Additional components (e.g., `clippy,rustfmt`) |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | `true` if cache was restored |
| `rust-version` | Installed Rust version |
| `rust-tag` | Cache tag for Rust installation |
| `cargo-tag` | Cache tag for cargo registry |
| `target-tag` | Cache tag for target directory |

## Separate Actions

```yaml
- uses: boringcache/rust/restore@v1
  id: cache
  with:
    workspace: my-org/my-project
    rust-version: stable

- run: cargo build --release

- uses: boringcache/rust/save@v1
  with:
    workspace: my-org/my-project
    rust-tag: ${{ steps.cache.outputs.rust-tag }}
    cargo-tag: ${{ steps.cache.outputs.cargo-tag }}
    target-tag: ${{ steps.cache.outputs.target-tag }}
```

## Code Structure

- `lib/restore.ts` - Restore caches, install Rust via mise
- `lib/save.ts` - Save caches
- `lib/utils.ts` - Shared utilities, mise helpers

## Build

```bash
npm install && npm run build && npm test
```

---
**See [../AGENTS.md](../AGENTS.md) for shared conventions.**
