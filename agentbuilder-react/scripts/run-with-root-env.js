const fs = require('fs');
const path = require('path');

const [, , scriptName] = process.argv;
if (!scriptName) {
  console.error('Usage: node scripts/run-with-root-env.js <react-script>');
  process.exit(1);
}

const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    if (!key) return;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
} else {
  console.warn('Root .env not found at ' + rootEnvPath);
}

require(path.join('react-scripts', 'scripts', scriptName));
