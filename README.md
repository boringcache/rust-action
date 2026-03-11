# boringcache/rust-action

Set up Rust and cache Cargo plus build outputs.

## When to use it

Choose this for Cargo builds, especially if you also want sccache without wiring it by hand.

## Quick start

```yaml
- uses: boringcache/rust-action@v1
  with:
    workspace: my-org/my-project
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}

- run: cargo build --release
```

## Trust model

- Restore works on pull requests with `BORINGCACHE_RESTORE_TOKEN`.
- Save is skipped automatically when no save-capable token is configured.
- When `sccache-mode: proxy` is enabled, restore-only jobs stay read-only.

## What it handles

- Rust toolchain from `rust-toolchain.toml`, `rust-toolchain`, or `.tool-versions`.
- Cargo registry and git dependencies.
- `target/`.
- Optional `~/.cargo/bin`.
- Optional sccache, either as an archive or through a local proxy.

## Key inputs

| Input | Description |
|-------|-------------|
| `workspace` | Workspace in `org/repo` form. |
| `rust-version` / `toolchain` | Override the detected Rust version or channel. |
| `targets`, `components`, `profile` | Extra rustup setup. |
| `cache-target` | Cache the `target/` directory. |
| `cache-cargo-bin` | Cache installed Cargo binaries. |
| `sccache` | Enable sccache. |
| `sccache-mode` | `local` archive mode or `proxy` CAS-backed mode. |
| `save-always` | Save even if the job fails. |

When `sccache-mode: proxy` is enabled, the proxy auto-downgrades to read-only when only a restore token is present.

## Outputs

| Output | Description |
|--------|-------------|
| `rust-version` | Installed Rust version. |
| `cache-hit` | Whether any cache was restored. |
| `sccache-hit` | Whether sccache cache was restored. |
| `workspace` | Resolved workspace name. |

## Learn more

- [Language actions docs](https://boringcache.com/docs#language-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
