import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use createRequire so we can pull CJS modules from scripts/node_modules
const require = createRequire(import.meta.url);

// firebase-admin v14 exports a flat API: { initializeApp, cert, getFirestore, … }
const {
  initializeApp,
  cert,
  deleteApp,
  getApp,
} = require(resolve(__dirname, 'node_modules/firebase-admin/lib/index.js'));

const { getFirestore } = require(
  resolve(__dirname, 'node_modules/firebase-admin/lib/firestore/index.js')
);

// ---------------------------------------------------------------------------
// 1. Parse .env.local manually (no dotenv – avoids $ expansion issues)
// ---------------------------------------------------------------------------
function readEnvLocal(filePath) {
  const lines = readFileSync(filePath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1); // everything after first '='
    env[key] = value;
  }
  return env;
}

const envPath = resolve(__dirname, '../.env.local');
const env = readEnvLocal(envPath);

const base64 = env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
if (!base64) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_BASE64 not found in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Initialise Firebase Admin SDK
// ---------------------------------------------------------------------------
const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

// ---------------------------------------------------------------------------
// 3. Export helpers
// ---------------------------------------------------------------------------
const OUTPUT_DIR = resolve(__dirname, 'firestore-export');
mkdirSync(OUTPUT_DIR, { recursive: true });

async function exportCollection(collectionPath, outputFile) {
  const snapshot = await db.collection(collectionPath).get();
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  writeFileSync(resolve(OUTPUT_DIR, outputFile), JSON.stringify(docs, null, 2), 'utf8');
  return docs.length;
}

async function exportDocument(docPath, outputFile) {
  const ref = db.doc(docPath);
  const snap = await ref.get();
  if (!snap.exists) {
    console.warn(`  WARNING: document "${docPath}" does not exist – writing null`);
    writeFileSync(resolve(OUTPUT_DIR, outputFile), JSON.stringify(null, null, 2), 'utf8');
    return 0;
  }
  const data = { id: snap.id, ...snap.data() };
  writeFileSync(resolve(OUTPUT_DIR, outputFile), JSON.stringify(data, null, 2), 'utf8');
  return 1;
}

// ---------------------------------------------------------------------------
// 4. Run exports
// ---------------------------------------------------------------------------
async function main() {
  console.log('Starting Firestore export…\n');

  const tasks = [
    { label: 'orders',              fn: () => exportCollection('orders',        'orders.json') },
    { label: 'recipients',          fn: () => exportCollection('recipients',    'recipients.json') },
    { label: 'employees',           fn: () => exportCollection('employees',     'employees.json') },
    { label: 'salaryRecords',       fn: () => exportCollection('salaryRecords', 'salary_records.json') },
    { label: '_system/settings (doc)', fn: () => exportDocument('_system/settings', 'settings.json') },
  ];

  const summary = [];
  for (const task of tasks) {
    process.stdout.write(`  Exporting ${task.label}…`);
    const count = await task.fn();
    console.log(` done (${count} record${count !== 1 ? 's' : ''})`);
    summary.push({ collection: task.label, count });
  }

  console.log('\n--- Export summary ---');
  for (const { collection, count } of summary) {
    console.log(`  ${collection.padEnd(28)} ${count} record${count !== 1 ? 's' : ''}`);
  }
  console.log(`\nFiles written to: ${OUTPUT_DIR}`);

  await deleteApp(app);
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
