import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const functionsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(functionsRoot, '..');

const FORBIDDEN_PATTERNS = [
  'FLUTTER_TEST',
  'sample_spots',
  'mockSampleSpots',
  'pack_malleshwaram_v1',
  'Simulated B5',
  'Sample C4',
  'Sample AI',
  'Sample Route Data',
  'Sample Discovery Data',
  'Sample Data (Domain',
  'Pending Commercial Confirmation',
  'Backend Submission Pending',
  'useMockDiscovery',
  'useMockData',
  'allowMockFallback: true',
  'SAMPLE_CLOSURE_FIXTURES',
  'offline-cultural-adapter',
  'offline-translation-engine',
  'offline-camera-ocr-adapter',
];

const FLUTTER_ONLY_FORBIDDEN = [
  'isTestMode',
  '_isWidgetTest',
];

function walkFiles(dir, extFilter, excludeDirs = []) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const normalized = full.replace(/\\/g, '/');
      if (excludeDirs.some((ex) => normalized.includes(ex))) continue;
      results.push(...walkFiles(full, extFilter, excludeDirs));
    } else if (entry.isFile() && extFilter(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const findings = [];

const flutterFiles = walkFiles(
  path.join(repoRoot, 'lib'),
  (name) => name.endsWith('.dart') && !name.endsWith('.g.dart') && !name.endsWith('.freezed.dart')
);

for (const file of flutterFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const patterns = [...FORBIDDEN_PATTERNS, ...FLUTTER_ONLY_FORBIDDEN];
  lines.forEach((line, idx) => {
    for (const pat of patterns) {
      if (line.includes(pat)) {
        findings.push(`${path.relative(repoRoot, file)}:${idx + 1}: matched "${pat}"`);
      }
    }
  });
}

const backendFiles = walkFiles(
  path.join(functionsRoot, 'src'),
  (name) => name.endsWith('.ts'),
  ['/tests', '/__tests__']
);

for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const pat of FORBIDDEN_PATTERNS) {
      if (line.includes(pat)) {
        findings.push(`${path.relative(repoRoot, file)}:${idx + 1}: matched "${pat}"`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Mock-eradication audit FAILED (${findings.length} violation(s)):`);
  for (const f of findings) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

console.log(
  `Mock-eradication audit PASSED (${flutterFiles.length} Dart files, ${backendFiles.length} production TS files scanned, 0 violations).`
);
