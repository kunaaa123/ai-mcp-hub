require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');
async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mcp_hub'
  });
  try {
    const r = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/GOOGL', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000
    });
    const meta = r.data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    console.log('GOOGL price:', price);

    await pool.query(`CREATE TABLE IF NOT EXISTS AG (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(10) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      currency VARCHAR(5) DEFAULT 'USD',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Table AG ready');

    const [ins] = await pool.query(
      'INSERT INTO AG (symbol, price, currency, recorded_at) VALUES (?, ?, ?, NOW())',
      ['GOOGL', price, 'USD']
    );
    console.log('INSERT OK, insertId:', ins.insertId);

    const [rows] = await pool.query('SELECT * FROM AG ORDER BY id DESC LIMIT 5');
    console.log('Data in AG:', JSON.stringify(rows, null, 2));
  } catch(e) { console.log('ERROR:', e.message); }
  await pool.end();
}
run();
