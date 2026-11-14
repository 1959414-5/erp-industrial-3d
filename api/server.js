// server.js — API Express que lê o MySQL e devolve o Dataset do painel 3D.
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { buildDataset } from './queries.js';
import { registerAi } from './ai.js';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_industrial_analytics',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
  // bancos em nuvem (TiDB Cloud, PlanetScale, Aiven...) exigem TLS: defina DB_SSL=true
  ...(/^(1|true|yes)$/i.test(process.env.DB_SSL || '') ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
});

const app = express();
// CORS: por padrão libera qualquer origem (dev). Em produção defina CORS_ORIGIN=https://seu-usuario.github.io
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',').map((x) => x.trim()) } : undefined));

// resposta imediata, sem tocar no banco: serve para "acordar" o serviço (Render grátis) e para monitor de uptime
app.get('/', (_req, res) => res.json({ ok: true, service: 'erp-industrial-3d-api' }));
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// saúde da API e do banco
app.get('/api/health', async (_req, res) => {
  try {
    const [[r]] = await pool.query('SELECT DATABASE() AS db, NOW() AS agora');
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// cache curto do dataset (evita refazer ~15 consultas a cada pergunta ao assistente)
let cache = { at: 0, data: null };
async function getDataset() {
  if (cache.data && Date.now() - cache.at < 15000) return cache.data;
  cache = { at: Date.now(), data: await buildDataset(pool) };
  return cache.data;
}

// assistente de IA: POST /api/ai/chat · GET /api/ai/status
registerAi(app, { pool, getDataset, json: express.json({ limit: '32kb' }) });

// endpoint único que o painel consome
app.get('/api/data', async (_req, res) => {
  try {
    const data = await getDataset();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`API ERP 3D no ar:  http://localhost:${PORT}/api/data`);
  console.log(`Saúde:             http://localhost:${PORT}/api/health`);
});
