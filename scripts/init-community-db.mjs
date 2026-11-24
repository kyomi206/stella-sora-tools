import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not set (checked environment and .env.local).');
    process.exit(1);
  }

  const sqlDir = path.join(__dirname, 'sql');
  const sqlFiles = fs
    .readdirSync(sqlDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const sql = neon(databaseUrl);
  for (const file of sqlFiles) {
    const rawSql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    const statements = rawSql
      .split(';')
      .map((chunk) =>
        chunk
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter(Boolean);

    for (const stmt of statements) {
      await sql.query(stmt);
    }
  }

  const rows = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'community_builds',
        'build_metrics',
        'build_votes',
        'build_views',
        'rate_limits',
        'community_feedback'
      )
    ORDER BY tablename ASC
  `;
  console.log(
    'Initialized community schema. Verified tables:',
    rows.map((r) => r.tablename).join(', ')
  );
}

main().catch((err) => {
  console.error('Failed to initialize community DB:', err);
  process.exit(1);
});
