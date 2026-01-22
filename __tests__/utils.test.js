"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../lib/utils");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
async function createTempDir() {
    return fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-test-'));
}
describe('getRustVersion', () => {
    it('returns explicit input when provided', async () => {
        const dir = await createTempDir();
        expect(await (0, utils_1.getRustVersion)('1.75', dir)).toBe('1.75');
        await fs.promises.rm(dir, { recursive: true, force: true });
    });
    it('reads rust-toolchain.toml channel', async () => {
        const dir = await createTempDir();
        await fs.promises.writeFile(path.join(dir, 'rust-toolchain.toml'), 'channel = "beta"');
        expect(await (0, utils_1.getRustVersion)('', dir)).toBe('beta');
        await fs.promises.rm(dir, { recursive: true, force: true });
    });
    it('falls back to rust-toolchain file', async () => {
        const dir = await createTempDir();
        await fs.promises.writeFile(path.join(dir, 'rust-toolchain'), 'nightly-2024-01-01');
        expect(await (0, utils_1.getRustVersion)('', dir)).toBe('nightly-2024-01-01');
        await fs.promises.rm(dir, { recursive: true, force: true });
    });
    it('falls back to .tool-versions file', async () => {
        const dir = await createTempDir();
        await fs.promises.writeFile(path.join(dir, '.tool-versions'), 'rust 1.74.1\nnodejs 20.0.0');
        expect(await (0, utils_1.getRustVersion)('', dir)).toBe('1.74.1');
        await fs.promises.rm(dir, { recursive: true, force: true });
    });
});
describe('wasCacheHit', () => {
    it('is false on non-zero exit', () => {
        utils_1.execBoringCache.lastOutput = 'Cache restored';
        expect((0, utils_1.wasCacheHit)(1)).toBe(false);
    });
    it('detects cache miss text', () => {
        utils_1.execBoringCache.lastOutput = 'Cache miss';
        expect((0, utils_1.wasCacheHit)(0)).toBe(false);
    });
    it('defaults to hit when exit code is zero and no miss patterns', () => {
        utils_1.execBoringCache.lastOutput = 'Restored from cache';
        expect((0, utils_1.wasCacheHit)(0)).toBe(true);
    });
});
describe('getWorkspace', () => {
    afterEach(() => {
        delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
    });
    it('prefixes default when missing org', () => {
        expect((0, utils_1.getWorkspace)('demo')).toBe('default/demo');
    });
    it('uses BORINGCACHE_DEFAULT_WORKSPACE when no input provided', () => {
        process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'org/demo';
        expect((0, utils_1.getWorkspace)('')).toBe('org/demo');
    });
});
