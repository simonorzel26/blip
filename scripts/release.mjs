#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packageJsonPath = join(process.cwd(), 'package.json');

function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error('Invalid version type. Use: major, minor, or patch');
  }
}

function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  const versionType = process.argv[2];

  if (!versionType) {
    console.log('Usage: npm run release <type>');
    console.log('Types: patch, minor, major');
    console.log('Examples:');
    console.log('  npm run release patch  # 1.0.0 -> 1.0.1');
    console.log('  npm run release minor  # 1.0.0 -> 1.1.0');
    console.log('  npm run release major  # 1.0.0 -> 2.0.0');
    process.exit(1);
  }

  try {
    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);

    // Calculate new version
    const newVersion = bumpVersion(currentVersion, versionType);
    console.log(`New version: ${newVersion}`);

    // Update package.json
    updatePackageJson(newVersion);
    console.log('Updated package.json');

    // Stage changes
    runCommand('git add package.json');

    // Commit changes
    runCommand(`git commit -m "chore: bump version to ${newVersion}"`);

    // Create and push tag
    const tagName = `v${newVersion}`;
    runCommand(`git tag ${tagName}`);

    // Push changes and tag
    runCommand('git push origin main');
    runCommand(`git push origin ${tagName}`);

    console.log(`\n✅ Successfully released version ${newVersion}!`);
    console.log(`📦 GitHub Actions workflow should now be running...`);
    console.log(`🔗 Check: https://github.com/simonorzel26/blip/actions`);

  } catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
  }
}

main();
