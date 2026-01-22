import * as core from '@actions/core';
import { execBoringCache, pathExists, hasGitDependencies, getCargoHome, getSccacheDir, stopSccacheServer } from './utils';
import * as path from 'path';

async function run(): Promise<void> {
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

    const cargoHome = getCargoHome();

    core.info('Saving to BoringCache...');

    let savedAny = false;

    // Save cargo cache (registry and git separately)
    if (cacheCargo) {
      const cargoRegistryDir = `${cargoHome}/registry`;
      const cargoGitDir = `${cargoHome}/git`;

      // Save cargo registry
      if (cargoRegistryTag && await pathExists(cargoRegistryDir)) {
        core.info(`Saving cargo registry [${cargoRegistryTag}]...`);
        const args = ['save', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`];
        if (exclude) {
          args.push('--exclude', exclude);
        }
        await execBoringCache(args);
        savedAny = true;
      } else if (cargoRegistryTag) {
        core.debug(`Skipping cargo registry: ${cargoRegistryDir} does not exist`);
      }

      // Save cargo git (only if project has git dependencies)
      if (cargoGitTag) {
        const lockPath = path.join(workingDir, 'Cargo.lock');
        const hasGitDeps = await hasGitDependencies(lockPath);
        if (hasGitDeps && await pathExists(cargoGitDir)) {
          core.info(`Saving cargo git [${cargoGitTag}]...`);
          const args = ['save', workspace, `${cargoGitTag}:${cargoGitDir}`];
          if (exclude) {
            args.push('--exclude', exclude);
          }
          await execBoringCache(args);
          savedAny = true;
        }
      }
    }

    // Save target cache
    if (cacheTarget && targetTag) {
      const targetDir = path.join(workingDir, 'target');

      if (await pathExists(targetDir)) {
        core.info(`Saving target [${targetTag}]...`);
        const args = ['save', workspace, `${targetTag}:${targetDir}`];
        if (exclude) {
          args.push('--exclude', exclude);
        }
        await execBoringCache(args);
        savedAny = true;
      } else {
        core.debug(`Skipping target: ${targetDir} does not exist`);
      }
    }

    // Save sccache cache
    if (useSccache && sccacheTag) {
      // Stop sccache server to flush all pending writes
      await stopSccacheServer();

      const sccacheDir = getSccacheDir();
      core.info(`Checking sccache directory: ${sccacheDir}`);
      if (await pathExists(sccacheDir)) {
        core.info(`Saving sccache [${sccacheTag}]...`);
        const args = ['save', workspace, `${sccacheTag}:${sccacheDir}`];
        // No exclude for sccache - it's already content-addressed
        await execBoringCache(args);
        savedAny = true;
      } else {
        core.info(`Skipping sccache: ${sccacheDir} does not exist (sccache may not have cached anything)`);
      }
    }

    if (!savedAny) {
      core.info('Nothing to save (no cargo registry, target, or sccache directory found)');
    }

    core.info('✓ Save to BoringCache complete');
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Save failed: ${error.message}`);
    }
  }
}

run();
