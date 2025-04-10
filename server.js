// server.js

// [모듈 불러오기]
// 필요한 모듈을 불러와서 웹 서버, 데이터베이스, 보안, 경로 관리 기능을 사용합니다.
const express = require('express');             
const sqlite3 = require('sqlite3').verbose();     
const cors = require('cors');                     
const path = require('path');                     
const bcrypt = require('bcrypt');                 

// [서버 및 DB 설정]
// Express 서버 인스턴스 생성, 포트와 데이터베이스 파일 경로를 지정합니다.
const app = express();
const port = 3000;
const DB_PATH = path.join(__dirname, 'database.db');

// [미들웨어 설정]
// CORS로 외부 요청 허용, JSON 데이터 자동 파싱, public 폴더의 정적 파일 제공
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// [SQLite DB 연결]
// 데이터베이스 파일과 연결하고, 성공/실패 로그 출력
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('DB 연결 실패:', err.message);
  else console.log('DB 연결 성공');
});

// [루트 엔드포인트]
// 서버가 정상 작동 중임을 간단한 메시지로 확인
app.get('/', (req, res) => {
  res.send('✈️ AeroCheck 서버 실행 중!');
});

// [회원가입 엔드포인트 (/register)]
// 클라이언트에서 username과 password를 받고, 비밀번호를 암호화한 후 DB에 저장
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username과 password는 필수입니다.' });
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: '해시화 오류' });
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.run(sql, [username, hashedPassword], function(err) {
      if (err)
        return res.status(500).json({ error: 'DB 오류', details: err.message });
      res.json({ message: '회원 가입 성공', userId: this.lastID });
    });
  });
});


// 로그인 엔드포인트 (/login)
// 입력받은 username으로 사용자 정보를 조회 후, bcrypt.compare로 비밀번호를 인증합니다.
app.post('/login', (req, res) => {
  const { username, password } = req.body; // 클라이언트에서 username과 password를 추출
  if (!username || !password)
    return res.status(400).json({ error: 'username과 password는 필수입니다.' }); 
    // 필수 값이 없을 경우 400 오류 응답

  const sql = "SELECT * FROM users WHERE username = ?"; // username으로 사용자 정보를 조회하는 SQL 쿼리

  db.get(sql, [username], (err, row) => { // DB에서 해당 사용자를 조회
    if (err) 
      return res.status(500).json({ error: 'DB 조회 오류', details: err.message });
      // DB 조회 시 오류가 발생하면 500 오류 응답

    if (!row) 
      return res.status(401).json({ error: '자격 증명 오류' });
      // 사용자가 없으면 401 오류(자격 증명 오류) 응답

    // 사용자가 존재하면, bcrypt.compare로 입력 비밀번호와 저장된 해시 비교
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) 
        return res.status(500).json({ error: '비교 오류' });
        // 비밀번호 비교 중 오류 발생 시 500 오류 응답

      // 비교 결과에 따라 로그인 성공 또는 실패 응답
      result 
        ? res.json({ message: '로그인 성공', user: { id: row.id, username: row.username } })
        : res.status(401).json({ error: '자격 증명 오류' });
    });
  });
});


// [검색 엔드포인트 (/search)]
// 클라이언트 검색 조건을 기반으로 동적으로 SQL 쿼리를 구성하고, 정렬 및 페이징 처리 후 결과 반환
app.get('/search', (req, res) => {
  const { type, country, operator, minFatal, maxFatal, startYear, endYear, sort, page = 1, limit = 20 } = req.query;
  const conditions = ["fatalities GLOB '[0-9]*'"];
  const values = [];
  if (type) { conditions.push('type LIKE ?'); values.push(`%${type}%`); }
  if (country) { conditions.push('country LIKE ?'); values.push(`%${country}%`); }
  if (operator) { conditions.push('operator LIKE ?'); values.push(`%${operator}%`); }
  if (minFatal) { conditions.push('CAST(fatalities AS INTEGER) >= ?'); values.push(minFatal); }
  if (maxFatal) { conditions.push('CAST(fatalities AS INTEGER) <= ?'); values.push(maxFatal); }
  if (startYear) { conditions.push('year >= ?'); values.push(startYear); }
  if (endYear) { conditions.push('year <= ?'); values.push(endYear); }
  
  let sql = 'SELECT * FROM aviation_accidents';
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  if (sort === 'year_asc') sql += ' ORDER BY year ASC';
  else if (sort === 'year_desc') sql += ' ORDER BY year DESC';
  else if (sort === 'fatalities_asc') sql += ' ORDER BY CAST(fatalities AS INTEGER) ASC';
  else if (sort === 'fatalities_desc') sql += ' ORDER BY CAST(fatalities AS INTEGER) DESC';
  else sql += ' ORDER BY year DESC';
  sql += ' LIMIT ? OFFSET ?';
  values.push(Number(limit));
  values.push((Number(page) - 1) * Number(limit));
  
  db.all(sql, values, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB 조회 실패', details: err.message });
    res.json(rows);
  });
});

// [연도 범위 조회 엔드포인트 (/year-range)]
// DB에서 유효한 연도의 최소값과 최대값을 집계하여 반환합니다.
app.get('/year-range', (req, res) => {
  const sql = "SELECT MIN(year) AS startYear, MAX(year) AS endYear FROM aviation_accidents WHERE year != 'unknown'";
  db.get(sql, [], (err, row) => {
    if (err) return res.status(500).json({ error: '연도 조회 실패', details: err.message });
    res.json(row);
  });
});

// [항공사 목록 조회 엔드포인트 (/airlines)]
// DB에서 중복 없이 고유한 항공사(operator) 목록을 정렬해서 반환합니다.
app.get('/airlines', (req, res) => {
  const sql = "SELECT DISTINCT operator FROM aviation_accidents WHERE operator IS NOT NULL ORDER BY operator ASC";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: '항공사 목록 조회 실패', details: err.message });
    res.json(rows);
  });
});

// [404 에러 처리 및 서버 실행]
// 정의되지 않은 경로에 대해 404 응답을 반환합니다.
app.use((req, res) => {
  res.status(404).json({ error: '잘못된 경로입니다.' });
});

// 서버 실행: 포트 3000에서 서버를 시작합니다.
app.listen(port, () => {
  console.log(`🚀 AeroCheck 서버가 실행 중입니다: http://localhost:${port}`);
});
