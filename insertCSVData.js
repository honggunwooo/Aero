// insertCSVData.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const DB_FILE = 'database.db';
const CSV_FILE = path.join(__dirname, 'data', 'aviation-accident.csv');

const db = new sqlite3.Database(DB_FILE);

const createAviationTableSQL = `
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

const createUserTableSQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
);
`;

// 두 테이블을 순차적으로 생성한 후 CSV 데이터를 로드
db.serialize(() => {
  db.run(createAviationTableSQL, (err) => {
    if (err) return console.error('❌ aviation_accidents 테이블 생성 실패:', err.message);
    console.log('✅ aviation_accidents 테이블 생성 완료');
  });
  db.run(createUserTableSQL, (err) => {
    if (err) return console.error('❌ users 테이블 생성 실패:', err.message);
    console.log('✅ users 테이블 생성 완료');
  });
  // 테이블 생성 후 CSV 데이터 로드 시작
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
