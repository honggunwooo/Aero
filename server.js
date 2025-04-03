// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

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

// 회원 가입 엔드포인트
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username과 password는 필수입니다.' });
  }
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: '비밀번호 해시화 중 오류 발생' });
    }
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.run(sql, [username, hashedPassword], function(err) {
      if (err) {
        return res.status(500).json({ error: 'DB 삽입 오류', details: err.message });
      }
      res.json({ message: '회원 가입 성공', userId: this.lastID });
    });
  });
});

// 로그인 엔드포인트
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username과 password는 필수입니다.' });
  }
  const sql = "SELECT * FROM users WHERE username = ?";
  db.get(sql, [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'DB 조회 오류', details: err.message });
    }
    if (!row) {
      return res.status(401).json({ error: '잘못된 자격 증명입니다.' });
    }
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: '비밀번호 비교 중 오류 발생' });
      }
      if (result) {
        res.json({ message: '로그인 성공', user: { id: row.id, username: row.username } });
      } else {
        res.status(401).json({ error: '잘못된 자격 증명입니다.' });
      }
    });
  });
});

// 검색 엔드포인트
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

  if (sort === 'year_asc') {
    sql += ' ORDER BY year ASC';
  } else if (sort === 'year_desc') {
    sql += ' ORDER BY year DESC';
  } else if (sort === 'fatalities_asc') {
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