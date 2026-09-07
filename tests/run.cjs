const { execFileSync } = require('node:child_process');
const { writeFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.tests.json'], { stdio: 'inherit' });
writeFileSync('artifacts/ability-tests/package.json', '{"type":"commonjs"}\n');
const tests = readdirSync(__dirname).filter(file => file.endsWith('.test.cjs')).map(file => path.join(__dirname, file));
execFileSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
