const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'academic_portal.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let db = null;

const getDb = () => {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('Database connection error:', err.message);
      else console.log('Connected to SQLite database');
    });
  }
  return db;
};

const closeDb = () => {
  if (db) {
    db.close((err) => {
      if (err) console.error('Error closing database:', err.message);
      else console.log('Database connection closed');
      db = null;
    });
  }
};

const run = (sql, params = []) => new Promise((resolve, reject) => {
  getDb().run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  getDb().get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  getDb().all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

module.exports = { getDb, closeDb, run, get, all };
