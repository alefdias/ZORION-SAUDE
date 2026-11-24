// test_db.js — diagnóstico local, sem credenciais no código.
// Uso:
//   PGPASSWORD='...' PGDATABASE=zorion node test_db.js
// Ou configure ~/.pgpass e rode: PGDATABASE=zorion node test_db.js

import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'zorion',
});

await client.connect().catch((e) => {
  console.error('Falha ao conectar. Defina PGPASSWORD (ou use ~/.pgpass) e PGDATABASE.');
  console.error(e.message);
  process.exit(1);
});

try {
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Entrada';");
  console.log('Entrada:', res.rows);
  const res2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Medicamento';");
  console.log('Medicamento:', res2.rows);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
}
