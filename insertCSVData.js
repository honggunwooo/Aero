// insertCSVData.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const DB_FILE = 'database.db';
const CSV_FILE = path.join(__dirname, 'data', 'aviation-accident.csv');

const db = new sqlite3.Database(DB_FILE);

const createTableSQL = `
CREATE TABLE IF NOT EXISTS aviation_accidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  type TEXT,
  registration TEXT,
  operator TEXT,
  fatalities TEXT,
  location TEXT,
  country TEXT,
  cat TEXT,
  year TEXT
);
`;

db.run(createTableSQL, (err) => {
  if (err) return console.error('❌ 테이블 생성 실패:', err.message);
  console.log('✅ 테이블 생성 완료');
  loadCSV();
});

function loadCSV() {
  const rows = [];
  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const {
        date, type, registration, operator,
        fatalities, location, country, cat, year
      } = row;
      if (date && type && registration && operator) {
        rows.push([date, type, registration, operator, fatalities, location, country, cat, year]);
      }
    })
    .on('end', () => {
      console.log(`📦 ${rows.length}건 로딩됨, DB에 삽입 중...`);
      insertData(rows);
    })
    .on('error', (err) => {
      console.error('❌ CSV 읽기 오류:', err.message);
    });
}

function insertData(rows) {
  const insertSQL = `
    INSERT INTO aviation_accidents
    (date, type, registration, operator, fatalities, location, country, cat, year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    rows.forEach(row => db.run(insertSQL, row));
    db.run('COMMIT', () => {
      console.log(`✅ ${rows.length}건 삽입 완료`);
      db.close();
    });
  });
}
