import pg from 'pg';
const { Client } = pg;
const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: '123',
  database: 'zorion',
});
await client.connect().catch(e => {
  client.database = 'axion';
  return client.connect();
});
try {
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Entrada';");
  console.log("Entrada:", res.rows);
  const res2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Medicamento';");
  console.log("Medicamento:", res2.rows);
} catch (e) {
  console.log(e);
}
await client.end();
