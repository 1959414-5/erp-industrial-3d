// snapshot.js — lê o MySQL uma vez e grava ../public/data.json.
// Use para publicar o painel estático (GitHub Pages) sem servidor no ar.
//   node snapshot.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset } from './queries.js';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_industrial_analytics',
  dateStrings: true,
});

const out = resolve(__dirname, '..', 'public', 'data.json');
try {
  const data = await buildDataset(pool);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
  console.log('Snapshot gravado em', out);
  console.log(`  ${data.lots.length} lotes · ${data.sellers.length} vendedores · ${data.machines.length} máquinas`);
} catch (e) {
  console.error('Falha ao gerar snapshot:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
