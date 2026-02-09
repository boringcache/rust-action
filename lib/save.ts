import * as core from '@actions/core';
import { execBoringCache, hasGitDependencies, getCargoHome, getSccacheDir, stopSccacheServer } from './utils';
import * as path from 'path';

async function run(): Promise<void> {
  try {
    const workspace = core.getInput('workspace') || core.getState('workspace');
    const workingDir = core.getInput('working-directory') || core.getState('workingDir') || process.cwd();
    const cacheCargo = core.getInput('cache-cargo') !== 'false' && core.getState('cacheCargo') !== 'false';
    const cacheCargoBin = core.getInput('cache-cargo-bin') === 'true' || core.getState('cacheCargoBin') === 'true';
    const cacheTarget = core.getInput('cache-target') !== 'false' && core.getState('cacheTarget') !== 'false';
    const useSccache = core.getInput('sccache') === 'true' || core.getState('useSccache') === 'true';
    const cargoRegistryTag = core.getInput('cargo-tag') || core.getState('cargoRegistryTag');
    const cargoGitTag = core.getState('cargoGitTag');
    const cargoBinTag = core.getState('cargoBinTag');
    const targetTag = core.getInput('target-tag') || core.getState('targetTag');
    const sccacheTag = core.getState('sccacheTag');
    const verbose = core.getState('verbose') === 'true';
    const exclude = core.getInput('exclude');

    if (!workspace) {
      core.info('No workspace found, skipping save');
      return;
    }

    const cargoHome = getCargoHome();

    core.info('Saving to BoringCache...');

    if (cacheCargo) {
      const cargoRegistryDir = `${cargoHome}/registry`;
      const cargoGitDir = `${cargoHome}/git`;

      if (cargoRegistryTag) {
        core.info(`Saving cargo registry [${cargoRegistryTag}]...`);
        const args = ['save', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`];
        if (verbose) args.push('--verbose');
        if (exclude) args.push('--exclude', exclude);
        await execBoringCache(args);
      }

      if (cargoGitTag) {
        const lockPath = path.join(workingDir, 'Cargo.lock');
        const hasGitDeps = await hasGitDependencies(lockPath);
        if (hasGitDeps) {
          core.info(`Saving cargo git [${cargoGitTag}]...`);
          const args = ['save', workspace, `${cargoGitTag}:${cargoGitDir}`];
          if (verbose) args.push('--verbose');
          if (exclude) args.push('--exclude', exclude);
          await execBoringCache(args);
        }
      }
    }

    if (cacheCargoBin && cargoBinTag) {
      const cargoBinDir = `${cargoHome}/bin`;
      core.info(`Saving cargo bin [${cargoBinTag}]...`);
      const args = ['save', workspace, `${cargoBinTag}:${cargoBinDir}`];
      if (verbose) args.push('--verbose');
      if (exclude) args.push('--exclude', exclude);
      await execBoringCache(args);
    }

    if (cacheTarget && targetTag) {
      const targetDir = path.join(workingDir, 'target');
      core.info(`Saving target [${targetTag}]...`);
      const args = ['save', workspace, `${targetTag}:${targetDir}`];
      if (verbose) args.push('--verbose');
      if (exclude) args.push('--exclude', exclude);
      await execBoringCache(args);
    }

    if (useSccache && sccacheTag) {
      await stopSccacheServer();
      const sccacheDir = getSccacheDir();
      core.info(`Saving sccache [${sccacheTag}]...`);
      const args = ['save', workspace, `${sccacheTag}:${sccacheDir}`];
      if (verbose) args.push('--verbose');
      if (exclude) args.push('--exclude', exclude);
      await execBoringCache(args);
    }

    core.info('Save complete');
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Save failed: ${error.message}`);
    }
  }
}

run();
