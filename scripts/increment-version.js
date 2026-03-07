#!/usr/bin/env node
/**
 * Increments the patch version (e.g. 1.0.3 → 1.0.4) in app.json.
 * Used as EAS production preBuildCommand so each prod build gets a new version.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const current = app.expo.version || '1.0.0';
const parts = current.split('.').map(Number);
if (parts.length < 3) {
  parts.push(0);
}
parts[2] = (parts[2] || 0) + 1;
const next = parts.join('.');

app.expo.version = next;
fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');
console.log(`Incremented version ${current} → ${next}`);
