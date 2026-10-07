const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || 'Jay@1234',
    database: 'peoplepay360',
  });

  console.log('Connecting to database...');
  await pool.query("UPDATE users SET role = 'HR Manager' WHERE role IN ('HR Payroll Manager', 'HR Payroll User')");
  await pool.query("UPDATE users SET role = 'HR Manager' WHERE id = 'USR-006'");
  await pool.query("UPDATE users SET role = 'Admin' WHERE id = 'USR-999'");
  await pool.query("UPDATE users SET role = 'Employee' WHERE id IN ('USR-001', 'USR-002')");

  const [rows] = await pool.query('SELECT id, name, email, role FROM users');
  console.log('Consolidated users in MySQL:', rows);
  await pool.end();
}

run().catch(console.error);
