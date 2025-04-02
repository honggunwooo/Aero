// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;
const DB_PATH = path.join(__dirname, 'database.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 데이터베이스 연결 실패:', err.message);
  } else {
    console.log('✅ SQLite 데이터베이스 연결됨');
  }
});

app.get('/', (req, res) => {
  res.send('✈️ AeroCheck 서버 실행 중!');
});

app.get('/search', (req, res) => {
  const { type, country, minFatal, maxFatal, startYear, endYear, sort, page = 1, limit = 20 } = req.query;
  const conditions = ["fatalities GLOB '[0-9]*'"]; // Ensure fatalities is numeric
  const values = [];

  if (type) {
    conditions.push('type LIKE ?');
    values.push(`%${type}%`);
  }
  if (country) {
    conditions.push('country LIKE ?');
    values.push(`%${country}%`);
  }
  if (minFatal) {
    conditions.push('CAST(fatalities AS INTEGER) >= ?');
    values.push(minFatal);
  }
  if (maxFatal) {
    conditions.push('CAST(fatalities AS INTEGER) <= ?');
    values.push(maxFatal);
  }
  if (startYear) {
    conditions.push('year >= ?');
    values.push(startYear);
  }
  if (endYear) {
    conditions.push('year <= ?');
    values.push(endYear);
  }

  let sql = 'SELECT * FROM aviation_accidents';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  if (sort === 'fatalities_asc') {
    sql += ' ORDER BY CAST(fatalities AS INTEGER) ASC';
  } else if (sort === 'fatalities_desc') {
    sql += ' ORDER BY CAST(fatalities AS INTEGER) DESC';
  } else {
    sql += ' ORDER BY year DESC';
  }

  sql += ' LIMIT ? OFFSET ?';
  values.push(Number(limit));
  values.push((Number(page) - 1) * Number(limit));

  db.all(sql, values, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'DB 조회 실패', details: err.message });
    }
    res.json(rows);
  });
});

app.get('/year-range', (req, res) => {
  const sql = `SELECT MIN(year) AS startYear, MAX(year) AS endYear FROM aviation_accidents WHERE year != 'unknown'`;
  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '연도 조회 실패', details: err.message });
    }
    res.json(row);
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '잘못된 경로입니다.' });
});

app.listen(port, () => {
  console.log(`🚀 AeroCheck 서버가 실행 중입니다: http://localhost:${port}`);
});