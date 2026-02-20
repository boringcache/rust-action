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
exports.findAvailablePort = exports.pathExists = exports.ensureBoringCache = void 0;
exports.execBoringCache = execBoringCache;
exports.wasCacheHit = wasCacheHit;
exports.getCargoHome = getCargoHome;
exports.configureCargoEnv = configureCargoEnv;
exports.setupRustToolchain = setupRustToolchain;
exports.getWorkspace = getWorkspace;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.getRustVersion = getRustVersion;
exports.hasGitDependencies = hasGitDependencies;
exports.getSccacheDir = getSccacheDir;
exports.configureSccacheEnv = configureSccacheEnv;
exports.startSccacheServer = startSccacheServer;
exports.installSccache = installSccache;
exports.stopSccacheServer = stopSccacheServer;
exports.startCacheRegistryProxy = startCacheRegistryProxy;
exports.stopCacheRegistryProxy = stopCacheRegistryProxy;
exports.configureSccacheProxyEnv = configureSccacheProxyEnv;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const action_core_1 = require("@boringcache/action-core");
Object.defineProperty(exports, "ensureBoringCache", { enumerable: true, get: function () { return action_core_1.ensureBoringCache; } });
Object.defineProperty(exports, "pathExists", { enumerable: true, get: function () { return action_core_1.pathExists; } });
Object.defineProperty(exports, "findAvailablePort", { enumerable: true, get: function () { return action_core_1.findAvailablePort; } });
let lastOutput = '';
async function execBoringCache(args) {
    lastOutput = '';
    let output = '';
    const code = await (0, action_core_1.execBoringCache)(args, {
        silent: true,
        listeners: {
            stdout: (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            },
            stderr: (data) => {
                const text = data.toString();
                output += text;
                process.stderr.write(text);
            }
        }
    });
    lastOutput = output;
    return code;
}
function wasCacheHit(exitCode) {
    if (exitCode !== 0) {
        return false;
    }
    if (!lastOutput) {
        return true;
    }
    const missPatterns = [/Cache miss/i, /No cache entries/i, /Found 0\//i];
    return !missPatterns.some(pattern => pattern.test(lastOutput));
}
function getCargoHome() {
    return process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(path.join(cargoHome, 'bin'));
    core.exportVariable('CARGO_INCREMENTAL', '0');
    core.exportVariable('CARGO_TERM_COLOR', 'always');
}
async function setupRustToolchain(version, options = {}) {
    const profile = options.profile || 'minimal';
    core.info(`Installing Rust ${version} via rustup...`);
    const installArgs = [
        'toolchain', 'install', version,
        '--profile', profile,
        '--no-self-update'
    ];
    await exec.exec('rustup', installArgs);
    await exec.exec('rustup', ['default', version]);
    if (options.targets) {
        const targetList = options.targets.split(',').map(t => t.trim()).filter(t => t);
        for (const target of targetList) {
            core.info(`Adding target: ${target}`);
            await exec.exec('rustup', ['target', 'add', target]);
        }
    }
    if (options.components) {
        const componentList = options.components.split(',').map(c => c.trim()).filter(c => c);
        for (const component of componentList) {
            core.info(`Adding component: ${component}`);
            await exec.exec('rustup', ['component', 'add', component]);
        }
    }
    await exec.exec('rustc', ['--version']);
}
function getWorkspace(inputWorkspace) {
    return (0, action_core_1.getWorkspace)(inputWorkspace);
}
function getCacheTagPrefix(inputCacheTag) {
    return (0, action_core_1.getCacheTagPrefix)(inputCacheTag, 'rust');
}
async function getRustVersion(inputVersion, workingDir) {
    if (inputVersion) {
        return inputVersion;
    }
    const toolchainToml = path.join(workingDir, 'rust-toolchain.toml');
    try {
        const content = await fs.promises.readFile(toolchainToml, 'utf-8');
        const match = content.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match) {
            return match[1];
        }
    }
    catch {
    }
    const toolchainFile = path.join(workingDir, 'rust-toolchain');
    try {
        const content = await fs.promises.readFile(toolchainFile, 'utf-8');
        return content.trim();
    }
    catch {
    }
    const toolVersionsFile = path.join(workingDir, '.tool-versions');
    try {
        const content = await fs.promises.readFile(toolVersionsFile, 'utf-8');
        const rustLine = content.split('\n').find(line => line.startsWith('rust '));
        if (rustLine) {
            return rustLine.split(/\s+/)[1].trim();
        }
    }
    catch {
    }
    return 'stable';
}
async function hasGitDependencies(lockPath) {
    try {
        const content = await fs.promises.readFile(lockPath, 'utf-8');
        return content.includes('source = "git+');
    }
    catch {
        return false;
    }
}
function getSccacheDir() {
    return process.env.SCCACHE_DIR || path.join(os.homedir(), '.cache', 'sccache');
}
function configureSccacheEnv(cacheSize) {
    const sccacheDir = getSccacheDir();
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    process.env.SCCACHE_DIR = sccacheDir;
    core.exportVariable('SCCACHE_DIR', sccacheDir);
    process.env.SCCACHE_CACHE_SIZE = cacheSize;
    core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
    fs.mkdirSync(sccacheDir, { recursive: true });
    core.info(`sccache configured: dir=${sccacheDir}, size=${cacheSize}`);
}
async function startSccacheServer() {
    core.info('Starting sccache server...');
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
async function installSccache() {
    const platform = os.platform();
    const arch = os.arch();
    try {
        let output = '';
        const result = await exec.exec('sccache', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
            listeners: {
                stdout: (data) => { output += data.toString(); }
            }
        });
        if (result === 0 && output.includes('sccache')) {
            core.info(`sccache already installed: ${output.trim()}`);
            return;
        }
    }
    catch {
    }
    core.info('Installing sccache...');
    const version = 'v0.13.0';
    let assetName = null;
    if (platform === 'linux') {
        if (arch === 'x64') {
            assetName = `sccache-${version}-x86_64-unknown-linux-musl`;
        }
        else if (arch === 'arm64') {
            assetName = `sccache-${version}-aarch64-unknown-linux-musl`;
        }
    }
    else if (platform === 'darwin') {
        if (arch === 'arm64') {
            assetName = `sccache-${version}-aarch64-apple-darwin`;
        }
    }
    else if (platform === 'win32') {
        if (arch === 'x64') {
            assetName = `sccache-${version}-x86_64-pc-windows-msvc`;
        }
    }
    if (!assetName) {
        core.info(`No prebuilt sccache binary for ${platform}/${arch}, installing via cargo...`);
        await exec.exec('cargo', ['install', 'sccache', '--locked']);
        await exec.exec('sccache', ['--version']);
        return;
    }
    const ext = platform === 'win32' ? '.zip' : '.tar.gz';
    const url = `https://github.com/mozilla/sccache/releases/download/${version}/${assetName}${ext}`;
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
    const archivePath = path.join(tempDir, `sccache${ext}`);
    try {
        const curlCode = await exec.exec('curl', ['-sS', '--fail', '--location', '--output', archivePath, url], { ignoreReturnCode: true });
        if (curlCode !== 0) {
            throw new Error(`Failed to download sccache from ${url}`);
        }
        if (platform === 'win32') {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        const binDir = path.join(os.homedir(), '.local', 'bin');
        await fs.promises.mkdir(binDir, { recursive: true });
        const binaryName = platform === 'win32' ? 'sccache.exe' : 'sccache';
        const srcPath = path.join(tempDir, assetName, binaryName);
        const destPath = path.join(binDir, binaryName);
        await fs.promises.copyFile(srcPath, destPath);
        if (platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(binDir);
        core.info(`sccache ${version} installed to ${destPath}`);
        await exec.exec('sccache', ['--version']);
    }
    finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}
async function stopSccacheServer() {
    core.info('Stopping sccache server to flush cache...');
    try {
        await exec.exec('sccache', ['--show-stats'], { ignoreReturnCode: true });
        await exec.exec('sccache', ['--stop-server'], { ignoreReturnCode: true });
    }
    catch {
        core.debug('sccache server stop failed (may not have been running)');
    }
}
async function startCacheRegistryProxy(workspace, port, tag) {
    const proxy = await (0, action_core_1.startRegistryProxy)({
        command: 'cache-registry',
        workspace,
        tag,
        host: '127.0.0.1',
        port,
        noPlatform: true,
        noGit: true,
    });
    await (0, action_core_1.waitForProxy)(proxy.port, 30000, proxy.pid);
    return proxy;
}
async function stopCacheRegistryProxy(pid) {
    await (0, action_core_1.stopRegistryProxy)(pid);
}
function configureSccacheProxyEnv(port) {
    const endpoint = `http://127.0.0.1:${port}/`;
    process.env.SCCACHE_WEBDAV_ENDPOINT = endpoint;
    core.exportVariable('SCCACHE_WEBDAV_ENDPOINT', endpoint);
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    core.info(`sccache proxy configured: endpoint=${endpoint}`);
}
