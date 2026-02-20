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
const core = __importStar(require("@actions/core"));
const utils_1 = require("./utils");
const path = __importStar(require("path"));
async function run() {
    var _a;
    try {
        const workspace = (0, utils_1.getWorkspace)(core.getInput('workspace'));
        const cacheTagPrefix = (0, utils_1.getCacheTagPrefix)(core.getInput('cache-tag'));
        const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
        const workingDir = core.getInput('working-directory') || process.cwd();
        const cacheCargo = core.getInput('cache-cargo') !== 'false';
        const cacheCargoBin = core.getInput('cache-cargo-bin') === 'true';
        const cacheTarget = core.getInput('cache-target') !== 'false';
        const useSccache = core.getInput('sccache') === 'true';
        const sccacheMode = core.getInput('sccache-mode') || 'local';
        const verbose = core.getInput('verbose') === 'true';
        const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
        const targets = core.getInput('targets');
        const components = core.getInput('components');
        const profile = core.getInput('profile') || 'minimal';
        const rustVersion = await (0, utils_1.getRustVersion)(inputVersion, workingDir);
        const cliVersion = core.getInput('cli-version') || 'v1.1.0';
        // Set outputs
        core.setOutput('workspace', workspace);
        core.setOutput('rust-version', rustVersion);
        core.setOutput('cache-tag', cacheTagPrefix);
        // Save state for post-job save
        core.saveState('workspace', workspace);
        core.saveState('cacheTagPrefix', cacheTagPrefix);
        core.saveState('rustVersion', rustVersion);
        core.saveState('workingDir', workingDir);
        core.saveState('cacheCargo', cacheCargo.toString());
        core.saveState('cacheCargoBin', cacheCargoBin.toString());
        core.saveState('cacheTarget', cacheTarget.toString());
        core.saveState('useSccache', useSccache.toString());
        core.saveState('sccacheMode', sccacheMode);
        core.saveState('verbose', verbose.toString());
        // Setup boringcache CLI
        if (cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)({ version: cliVersion });
        }
        // Configure cargo environment
        (0, utils_1.configureCargoEnv)();
        const cargoHome = (0, utils_1.getCargoHome)();
        // Generate cache tags
        // Registry/git can be shared across Rust versions (just source code)
        const cargoRegistryTag = `${cacheTagPrefix}-cargo-registry`;
        const cargoGitTag = `${cacheTagPrefix}-cargo-git`;
        const cargoBinTag = `${cacheTagPrefix}-cargo-bin`;
        // Target and sccache are version-specific (compiled artifacts)
        const rustMajorMinor = ((_a = rustVersion.match(/^(\d+\.\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || rustVersion;
        const targetTag = `${cacheTagPrefix}-target-rust${rustMajorMinor}`;
        const sccacheTag = `${cacheTagPrefix}-sccache-rust${rustMajorMinor}`;
        core.setOutput('cargo-tag', cargoRegistryTag);
        core.setOutput('cargo-bin-tag', cargoBinTag);
        core.setOutput('target-tag', targetTag);
        core.setOutput('sccache-tag', sccacheTag);
        // Restore caches
        let registryRestored = false;
        let gitRestored = false;
        let targetRestored = false;
        // Restore cargo registry
        if (cacheCargo) {
            const cargoRegistryDir = `${cargoHome}/registry`;
            const cargoGitDir = `${cargoHome}/git`;
            core.info('Restoring cargo registry from BoringCache...');
            const registryArgs = ['restore', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`];
            if (verbose)
                registryArgs.push('--verbose');
            const registryResult = await (0, utils_1.execBoringCache)(registryArgs);
            if ((0, utils_1.wasCacheHit)(registryResult)) {
                core.info('✓ Cargo registry restored from BoringCache');
                registryRestored = true;
            }
            else {
                core.info('Cargo registry not in cache');
            }
            // Restore cargo git (only if project has git dependencies)
            const lockPath = path.join(workingDir, 'Cargo.lock');
            const hasGitDeps = await (0, utils_1.hasGitDependencies)(lockPath);
            if (hasGitDeps) {
                core.info('Restoring cargo git from BoringCache...');
                const gitArgs = ['restore', workspace, `${cargoGitTag}:${cargoGitDir}`];
                if (verbose)
                    gitArgs.push('--verbose');
                const gitResult = await (0, utils_1.execBoringCache)(gitArgs);
                if ((0, utils_1.wasCacheHit)(gitResult)) {
                    core.info('✓ Cargo git restored from BoringCache');
                    gitRestored = true;
                }
                else {
                    core.info('Cargo git not in cache');
                }
            }
            else {
                gitRestored = true; // No git deps, skip saving later
            }
            core.saveState('cargoRegistryRestored', registryRestored.toString());
            core.saveState('cargoGitRestored', gitRestored.toString());
            core.saveState('cargoRegistryTag', cargoRegistryTag);
            core.saveState('cargoGitTag', cargoGitTag);
        }
        // Restore cargo bin (installed cargo binaries like cargo-nextest)
        let cargoBinRestored = false;
        if (cacheCargoBin) {
            const cargoBinDir = `${cargoHome}/bin`;
            core.info('Restoring cargo bin from BoringCache...');
            const binArgs = ['restore', workspace, `${cargoBinTag}:${cargoBinDir}`];
            if (verbose)
                binArgs.push('--verbose');
            const binResult = await (0, utils_1.execBoringCache)(binArgs);
            if ((0, utils_1.wasCacheHit)(binResult)) {
                core.info('✓ Cargo bin restored from BoringCache');
                cargoBinRestored = true;
            }
            else {
                core.info('Cargo bin not in cache');
            }
            core.saveState('cargoBinRestored', cargoBinRestored.toString());
            core.saveState('cargoBinTag', cargoBinTag);
        }
        // Restore target cache
        if (cacheTarget) {
            const targetDir = path.join(workingDir, 'target');
            core.info('Restoring target from BoringCache...');
            const targetArgs = ['restore', workspace, `${targetTag}:${targetDir}`];
            if (verbose)
                targetArgs.push('--verbose');
            const targetResult = await (0, utils_1.execBoringCache)(targetArgs);
            if ((0, utils_1.wasCacheHit)(targetResult)) {
                core.info('✓ Target restored from BoringCache');
                targetRestored = true;
            }
            else {
                core.info('Target not in cache');
            }
            core.saveState('targetRestored', targetRestored.toString());
            core.saveState('targetTag', targetTag);
        }
        // Setup and restore sccache
        let sccacheRestored = false;
        if (useSccache) {
            // Install sccache binary
            await (0, utils_1.installSccache)();
            if (sccacheMode === 'proxy') {
                const port = await (0, utils_1.findAvailablePort)();
                const proxy = await (0, utils_1.startCacheRegistryProxy)(workspace, port, cacheTagPrefix);
                (0, utils_1.configureSccacheProxyEnv)(proxy.port);
                await (0, utils_1.startSccacheServer)();
                core.saveState('proxyPid', proxy.pid.toString());
                core.saveState('proxyPort', proxy.port.toString());
            }
            else {
                (0, utils_1.configureSccacheEnv)(sccacheCacheSize);
                // Restore sccache cache directory BEFORE starting the server.
                // sccache indexes its local cache at startup, so files must be on disk first.
                const sccacheDir = (0, utils_1.getSccacheDir)();
                core.info('Restoring sccache from BoringCache...');
                const sccacheArgs = ['restore', workspace, `${sccacheTag}:${sccacheDir}`];
                if (verbose)
                    sccacheArgs.push('--verbose');
                const sccacheResult = await (0, utils_1.execBoringCache)(sccacheArgs);
                if ((0, utils_1.wasCacheHit)(sccacheResult)) {
                    core.info('✓ sccache restored from BoringCache');
                    sccacheRestored = true;
                }
                else {
                    core.info('sccache not in cache (first run or cache invalidated)');
                }
                // Now start the server — it will index the restored cache files
                await (0, utils_1.startSccacheServer)();
                core.saveState('sccacheRestored', sccacheRestored.toString());
                core.saveState('sccacheTag', sccacheTag);
            }
        }
        // Setup Rust toolchain using rustup (pre-installed on GitHub runners)
        await (0, utils_1.setupRustToolchain)(rustVersion, { profile, targets, components });
        // Set cache-hit output
        const cacheHit = registryRestored || cargoBinRestored || targetRestored || sccacheRestored;
        core.setOutput('cache-hit', cacheHit.toString());
        core.setOutput('sccache-hit', sccacheRestored.toString());
        core.info('✓ Restore from BoringCache complete');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }
}
run();
