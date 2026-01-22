import * as core from '@actions/core';
import {
  ensureBoringCache,
  execBoringCache,
  getWorkspace,
  getCacheTagPrefix,
  getRustVersion,
  setupRustToolchain,
  configureCargoEnv,
  getCargoHome,
  wasCacheHit,
  hasGitDependencies,
  RustToolchainOptions,
  installSccache,
  configureSccacheEnv,
  getSccacheDir
} from './utils';
import * as path from 'path';

async function run(): Promise<void> {
  try {
    const workspace = getWorkspace(core.getInput('workspace'));
    const cacheTagPrefix = getCacheTagPrefix(core.getInput('cache-tag'));
    const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
    const workingDir = core.getInput('working-directory') || process.cwd();
    const cacheCargo = core.getInput('cache-cargo') !== 'false';
    const cacheTarget = core.getInput('cache-target') !== 'false';
    const useSccache = core.getInput('sccache') === 'true';
    const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
    const targets = core.getInput('targets');
    const components = core.getInput('components');
    const profile = core.getInput('profile') || 'minimal';

    const rustVersion = await getRustVersion(inputVersion, workingDir);
    const cliVersion = core.getInput('cli-version') || 'v1.0.0';

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
    core.saveState('cacheTarget', cacheTarget.toString());
    core.saveState('useSccache', useSccache.toString());

    // Setup boringcache CLI
    if (cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: cliVersion });
    }

    // Configure cargo environment
    configureCargoEnv();

    const cargoHome = getCargoHome();

    // Generate cache tags
    // Registry/git can be shared across Rust versions (just source code)
    const cargoRegistryTag = `${cacheTagPrefix}-cargo-registry`;
    const cargoGitTag = `${cacheTagPrefix}-cargo-git`;
    // Target and sccache are version-specific (compiled artifacts)
    const rustMajorMinor = rustVersion.match(/^(\d+\.\d+)/)?.[1] || rustVersion;
    const targetTag = `${cacheTagPrefix}-target-rust${rustMajorMinor}`;
    const sccacheTag = `${cacheTagPrefix}-sccache-rust${rustMajorMinor}`;

    core.setOutput('cargo-tag', cargoRegistryTag);
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
      const registryResult = await execBoringCache(
        ['restore', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`]
      );
      if (wasCacheHit(registryResult)) {
        core.info('✓ Cargo registry restored from BoringCache');
        registryRestored = true;
      } else {
        core.info('Cargo registry not in cache');
      }

      // Restore cargo git (only if project has git dependencies)
      const lockPath = path.join(workingDir, 'Cargo.lock');
      const hasGitDeps = await hasGitDependencies(lockPath);
      if (hasGitDeps) {
        core.info('Restoring cargo git from BoringCache...');
        const gitResult = await execBoringCache(
          ['restore', workspace, `${cargoGitTag}:${cargoGitDir}`]
        );
        if (wasCacheHit(gitResult)) {
          core.info('✓ Cargo git restored from BoringCache');
          gitRestored = true;
        } else {
          core.info('Cargo git not in cache');
        }
      } else {
        gitRestored = true; // No git deps, skip saving later
      }

      core.saveState('cargoRegistryRestored', registryRestored.toString());
      core.saveState('cargoGitRestored', gitRestored.toString());
      core.saveState('cargoRegistryTag', cargoRegistryTag);
      core.saveState('cargoGitTag', cargoGitTag);
    }

    // Restore target cache
    if (cacheTarget) {
      const targetDir = path.join(workingDir, 'target');

      core.info('Restoring target from BoringCache...');
      const targetResult = await execBoringCache(
        ['restore', workspace, `${targetTag}:${targetDir}`]
      );

      if (wasCacheHit(targetResult)) {
        core.info('✓ Target restored from BoringCache');
        targetRestored = true;
      } else {
        core.info('Target not in cache');
      }

      core.saveState('targetRestored', targetRestored.toString());
      core.saveState('targetTag', targetTag);
    }

    // Setup and restore sccache
    let sccacheRestored = false;
    if (useSccache) {
      // Install sccache binary
      await installSccache();

      // Configure sccache environment and start server
      await configureSccacheEnv(sccacheCacheSize);

      // Restore sccache cache directory
      const sccacheDir = getSccacheDir();
      core.info('Restoring sccache from BoringCache...');
      const sccacheResult = await execBoringCache(
        ['restore', workspace, `${sccacheTag}:${sccacheDir}`]
      );

      if (wasCacheHit(sccacheResult)) {
        core.info('✓ sccache restored from BoringCache');
        sccacheRestored = true;
      } else {
        core.info('sccache not in cache (first run or cache invalidated)');
      }

      core.saveState('sccacheRestored', sccacheRestored.toString());
      core.saveState('sccacheTag', sccacheTag);
    }

    // Setup Rust toolchain using rustup (pre-installed on GitHub runners)
    await setupRustToolchain(rustVersion, { profile, targets, components });

    // Set cache-hit output
    const cacheHit = registryRestored || targetRestored || sccacheRestored;
    core.setOutput('cache-hit', cacheHit.toString());
    core.setOutput('sccache-hit', sccacheRestored.toString());

    core.info('✓ Restore from BoringCache complete');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
