import { execBoringCache, getRustVersion, getWorkspace, wasCacheHit } from '../lib/utils';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function createTempDir(): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-test-'));
}

describe('getRustVersion', () => {
  it('returns explicit input when provided', async () => {
    const dir = await createTempDir();
    expect(await getRustVersion('1.75', dir)).toBe('1.75');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('reads rust-toolchain.toml channel', async () => {
    const dir = await createTempDir();
    await fs.promises.writeFile(path.join(dir, 'rust-toolchain.toml'), 'channel = "beta"');
    expect(await getRustVersion('', dir)).toBe('beta');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('falls back to rust-toolchain file', async () => {
    const dir = await createTempDir();
    await fs.promises.writeFile(path.join(dir, 'rust-toolchain'), 'nightly-2024-01-01');
    expect(await getRustVersion('', dir)).toBe('nightly-2024-01-01');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('falls back to .tool-versions file', async () => {
    const dir = await createTempDir();
    await fs.promises.writeFile(path.join(dir, '.tool-versions'), 'rust 1.74.1\nnodejs 20.0.0');
    expect(await getRustVersion('', dir)).toBe('1.74.1');
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});

describe('wasCacheHit', () => {
  it('is false on non-zero exit', () => {
    (execBoringCache as any).lastOutput = 'Cache restored';
    expect(wasCacheHit(1)).toBe(false);
  });

  it('detects cache miss text', () => {
    (execBoringCache as any).lastOutput = 'Cache miss';
    expect(wasCacheHit(0)).toBe(false);
  });

  it('defaults to hit when exit code is zero and no miss patterns', () => {
    (execBoringCache as any).lastOutput = 'Restored from cache';
    expect(wasCacheHit(0)).toBe(true);
  });
});

describe('getWorkspace', () => {
  afterEach(() => {
    delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
  });

  it('prefixes default when missing org', () => {
    expect(getWorkspace('demo')).toBe('default/demo');
  });

  it('uses BORINGCACHE_DEFAULT_WORKSPACE when no input provided', () => {
    process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'org/demo';
    expect(getWorkspace('')).toBe('org/demo');
  });
});
