const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const NOME = process.env.DB_NAME || 'borderkick';
const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};
const sql = (f) => fs.readFileSync(path.join(__dirname, 'database', f), 'utf8');
let pool;

async function iniciar() {
  const c = await mysql.createConnection({ ...cfg, multipleStatements: true });
  try {
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${NOME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.query(`USE \`${NOME}\``);
    await c.query("SET time_zone = '+00:00'");
    await c.query(sql('schema.sql'));
    await c.query(sql('seed.sql'));
    const [[{ n }]] = await c.query('SELECT COUNT(*) n FROM pacotes');
    if (!n) await c.query(sql('seed_demo.sql'));
    const email = (process.env.ATENDENTE_EMAIL || 'atendente@borderkick.com').toLowerCase();
    const [ex] = await c.query('SELECT 1 FROM usuarios WHERE email=?', [email]);
    if (!ex.length) {
      await c.query("INSERT INTO usuarios(nome,sobrenome,email,senha_hash,papel_id) VALUES('Atendente','BorderKick',?,?,2)",
        [email, bcrypt.hashSync(process.env.ATENDENTE_SENHA || 'Atendente@123', 10)]);
    }
  } finally { await c.end(); }

  pool = mysql.createPool({ ...cfg, database: NOME, waitForConnections: true, connectionLimit: 10, dateStrings: true, charset: 'utf8mb4' });
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

  try {
    await pool.query('DROP TRIGGER IF EXISTS trg_reservas_exige_visto');
    await pool.query(sql('trigger.sql'));
  } catch (e) {
    console.warn('Aviso: trigger de proteção não criada (' + e.message + '). A regra continua valendo na aplicação.');
  }
}

const q = async (s, p = []) => (await pool.query(s, p))[0];
const um = async (s, p = []) => (await q(s, p))[0];
async function tx(fn) {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const r = await fn(c); await c.commit(); return r; }
  catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}
module.exports = { iniciar, q, um, tx };
