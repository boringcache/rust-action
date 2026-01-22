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
    try {
        // Read from input first (sub-actions pattern), fall back to state (main+post pattern)
        const workspace = core.getInput('workspace') || core.getState('workspace');
        const workingDir = core.getInput('working-directory') || core.getState('workingDir') || process.cwd();
        const cacheCargo = core.getInput('cache-cargo') !== 'false' && core.getState('cacheCargo') !== 'false';
        const cacheTarget = core.getInput('cache-target') !== 'false' && core.getState('cacheTarget') !== 'false';
        const useSccache = core.getInput('sccache') === 'true' || core.getState('useSccache') === 'true';
        const cargoRegistryTag = core.getInput('cargo-tag') || core.getState('cargoRegistryTag');
        const cargoGitTag = core.getState('cargoGitTag'); // Only from state, derived from registry tag
        const targetTag = core.getInput('target-tag') || core.getState('targetTag');
        const sccacheTag = core.getState('sccacheTag');
        const exclude = core.getInput('exclude');
        if (!workspace) {
            core.info('No workspace found, skipping save');
            return;
        }
        const cargoHome = (0, utils_1.getCargoHome)();
        core.info('Saving to BoringCache...');
        let savedAny = false;
        // Save cargo cache (registry and git separately)
        if (cacheCargo) {
            const cargoRegistryDir = `${cargoHome}/registry`;
            const cargoGitDir = `${cargoHome}/git`;
            // Save cargo registry
            if (cargoRegistryTag && await (0, utils_1.pathExists)(cargoRegistryDir)) {
                core.info(`Saving cargo registry [${cargoRegistryTag}]...`);
                const args = ['save', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`];
                if (exclude) {
                    args.push('--exclude', exclude);
                }
                await (0, utils_1.execBoringCache)(args);
                savedAny = true;
            }
            else if (cargoRegistryTag) {
                core.debug(`Skipping cargo registry: ${cargoRegistryDir} does not exist`);
            }
            // Save cargo git (only if project has git dependencies)
            if (cargoGitTag) {
                const lockPath = path.join(workingDir, 'Cargo.lock');
                const hasGitDeps = await (0, utils_1.hasGitDependencies)(lockPath);
                if (hasGitDeps && await (0, utils_1.pathExists)(cargoGitDir)) {
                    core.info(`Saving cargo git [${cargoGitTag}]...`);
                    const args = ['save', workspace, `${cargoGitTag}:${cargoGitDir}`];
                    if (exclude) {
                        args.push('--exclude', exclude);
                    }
                    await (0, utils_1.execBoringCache)(args);
                    savedAny = true;
                }
            }
        }
        // Save target cache
        if (cacheTarget && targetTag) {
            const targetDir = path.join(workingDir, 'target');
            if (await (0, utils_1.pathExists)(targetDir)) {
                core.info(`Saving target [${targetTag}]...`);
                const args = ['save', workspace, `${targetTag}:${targetDir}`];
                if (exclude) {
                    args.push('--exclude', exclude);
                }
                await (0, utils_1.execBoringCache)(args);
                savedAny = true;
            }
            else {
                core.debug(`Skipping target: ${targetDir} does not exist`);
            }
        }
        // Save sccache cache
        if (useSccache && sccacheTag) {
            // Stop sccache server to flush all pending writes
            await (0, utils_1.stopSccacheServer)();
            const sccacheDir = (0, utils_1.getSccacheDir)();
            core.info(`Checking sccache directory: ${sccacheDir}`);
            if (await (0, utils_1.pathExists)(sccacheDir)) {
                core.info(`Saving sccache [${sccacheTag}]...`);
                const args = ['save', workspace, `${sccacheTag}:${sccacheDir}`];
                // No exclude for sccache - it's already content-addressed
                await (0, utils_1.execBoringCache)(args);
                savedAny = true;
            }
            else {
                core.info(`Skipping sccache: ${sccacheDir} does not exist (sccache may not have cached anything)`);
            }
        }
        if (!savedAny) {
            core.info('Nothing to save (no cargo registry, target, or sccache directory found)');
        }
        core.info('✓ Save to BoringCache complete');
    }
    catch (error) {
        if (error instanceof Error) {
            core.warning(`Save failed: ${error.message}`);
        }
    }
}
run();
