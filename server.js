// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;
const DB_PATH = path.join(__dirname, 'database.db');

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite DB 연결
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 데이터베이스 연결 실패:', err.message);
  } else {
    console.log('✅ SQLite 데이터베이스 연결됨');
  }
});

// 기본 라우터
app.get('/', (req, res) => {
  res.send('✈️ AeroCheck 서버 실행 중!');
});

// 사고이력 검색 API (기종 기반)
app.get('/search', (req, res) => {
  const { type } = req.query;
  if (!type) {
    return res.status(400).json({ error: '기종(type)을 입력하세요.' });
  }

  const sql = `SELECT * FROM aviation_accidents WHERE type LIKE ?`;
  db.all(sql, [`%${type}%`], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'DB 조회 실패', details: err.message });
    }
    res.json(rows);
  });
});

// 잘못된 경로 처리
app.use((req, res) => {
  res.status(404).json({ error: '잘못된 경로입니다.' });
});

// 서버 실행
app.listen(port, () => {
  console.log(`🚀 AeroCheck 서버가 실행 중입니다: http://localhost:${port}`);
});
