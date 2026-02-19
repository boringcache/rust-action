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
exports.ensureBoringCache = void 0;
exports.execBoringCache = execBoringCache;
exports.wasCacheHit = wasCacheHit;
exports.getCargoHome = getCargoHome;
exports.configureCargoEnv = configureCargoEnv;
exports.setupRustToolchain = setupRustToolchain;
exports.getWorkspace = getWorkspace;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.getRustVersion = getRustVersion;
exports.pathExists = pathExists;
exports.hasGitDependencies = hasGitDependencies;
exports.getSccacheDir = getSccacheDir;
exports.configureSccacheEnv = configureSccacheEnv;
exports.startSccacheServer = startSccacheServer;
exports.installSccache = installSccache;
exports.stopSccacheServer = stopSccacheServer;
exports.findAvailablePort = findAvailablePort;
exports.startCacheRegistryProxy = startCacheRegistryProxy;
exports.stopCacheRegistryProxy = stopCacheRegistryProxy;
exports.configureSccacheProxyEnv = configureSccacheProxyEnv;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const net = __importStar(require("net"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const action_core_1 = require("@boringcache/action-core");
Object.defineProperty(exports, "ensureBoringCache", { enumerable: true, get: function () { return action_core_1.ensureBoringCache; } });
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
    return process.env.CARGO_HOME || `${os.homedir()}/.cargo`;
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(`${cargoHome}/bin`);
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
    let workspace = inputWorkspace || process.env.BORINGCACHE_DEFAULT_WORKSPACE || '';
    if (!workspace) {
        core.setFailed('Workspace is required. Set workspace input or BORINGCACHE_DEFAULT_WORKSPACE env var.');
        throw new Error('Workspace required');
    }
    if (!workspace.includes('/')) {
        workspace = `default/${workspace}`;
    }
    return workspace;
}
function getCacheTagPrefix(inputCacheTag) {
    if (inputCacheTag) {
        return inputCacheTag;
    }
    const repo = process.env.GITHUB_REPOSITORY || '';
    if (repo) {
        const repoName = repo.split('/')[1] || repo;
        return repoName;
    }
    return 'rust';
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
async function pathExists(p) {
    try {
        await fs.promises.access(p);
        return true;
    }
    catch {
        return false;
    }
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
    return process.env.SCCACHE_DIR || `${os.homedir()}/.cache/sccache`;
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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            res.resume();
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
                resolve(res.statusCode);
            }
            else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}
async function findAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr !== 'string') {
                const port = addr.port;
                server.close(() => resolve(port));
            }
            else {
                server.close(() => reject(new Error('Failed to get port')));
            }
        });
        server.on('error', reject);
    });
}
async function startCacheRegistryProxy(workspace, port) {
    const logFile = path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
    const fd = fs.openSync(logFile, 'w');
    const child = (0, child_process_1.spawn)('boringcache', [
        'cache-registry', workspace,
        '--host', '127.0.0.1',
        '--port', port.toString(),
        '--no-platform',
        '--no-git'
    ], {
        detached: true,
        stdio: ['ignore', fd, fd]
    });
    child.unref();
    fs.closeSync(fd);
    if (!child.pid) {
        throw new Error('Failed to start cache-registry proxy');
    }
    core.info(`Cache-registry proxy starting (pid=${child.pid}, port=${port})...`);
    const maxWait = 30000;
    const interval = 500;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        try {
            await httpGet(`http://127.0.0.1:${port}/v2/`);
            core.info(`Cache-registry proxy ready on port ${port}`);
            return { pid: child.pid, port };
        }
        catch {
            await sleep(interval);
        }
    }
    try {
        const logs = fs.readFileSync(logFile, 'utf-8');
        core.error(`Cache-registry proxy logs:\n${logs}`);
    }
    catch { }
    throw new Error(`Cache-registry proxy failed to become ready within ${maxWait / 1000}s`);
}
async function stopCacheRegistryProxy(pid) {
    try {
        process.kill(pid, 'SIGTERM');
        core.info(`Stopped cache-registry proxy (pid=${pid})`);
    }
    catch (err) {
        if (err.code === 'ESRCH') {
            core.info(`Cache-registry proxy (pid=${pid}) already exited`);
        }
        else {
            core.warning(`Failed to stop cache-registry proxy: ${err.message}`);
        }
    }
}
function configureSccacheProxyEnv(port) {
    const endpoint = `http://127.0.0.1:${port}/`;
    process.env.SCCACHE_WEBDAV_ENDPOINT = endpoint;
    core.exportVariable('SCCACHE_WEBDAV_ENDPOINT', endpoint);
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    core.info(`sccache proxy configured: endpoint=${endpoint}`);
}
