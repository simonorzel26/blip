#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcTauri = path.join(projectRoot, 'src-tauri');
const targetDir = path.join(srcTauri, 'target');

// Ensure target directory exists
fs.mkdirSync(targetDir, { recursive: true });

// Compute tauri binary path in node_modules to avoid PATH/env quirks
const tauriBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tauri.cmd' : 'tauri'
);

// Build args
const userArgs = process.argv.slice(2);
const args = ['build'];

// Pick sensible defaults per platform
if (process.platform === 'win32') {
  // Produce a .exe installer via NSIS when available
  args.push('--bundles', 'nsis');
}

// Pass-through any extra flags from the user
args.push(...userArgs);

// Environment
const env = {
  ...process.env,
  CARGO_TARGET_DIR: targetDir,
  TAURI_DIR: srcTauri,
};

console.log(`Using CARGO_TARGET_DIR: ${env.CARGO_TARGET_DIR}`);
console.log(`Using TAURI_DIR: ${env.TAURI_DIR}`);
console.log(`Spawning: ${tauriBin} ${args.join(' ')}`);

const child = spawn(tauriBin, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});


