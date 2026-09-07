// Writes dist/bundle-manifest.json after `vite build`: the commit that produced the bundle
// plus every file with its size and SHA-256. The desktop app compares this against the copy
// published on GitHub Pages to decide whether a newer build of main is available.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execSync } = require('node:child_process');

const dist = path.resolve(__dirname, '..', 'dist');
const commit = process.env.GITHUB_SHA || (() => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'local-' + Date.now(); } })();

function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = base ? base + '/' + entry.name : entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), rel) : [rel];
  });
}

const files = walk(dist).filter(rel => rel !== 'bundle-manifest.json').sort().map(rel => {
  const data = fs.readFileSync(path.join(dist, rel));
  return { path: rel, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
});
const manifest = { commit, builtAt: new Date().toISOString(), files };
fs.writeFileSync(path.join(dist, 'bundle-manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`bundle-manifest.json: ${files.length} files, ${(files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1)} MB, commit ${commit.slice(0, 7)}`);
