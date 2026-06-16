const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'blog.db');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ─── Database Setup ───────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT DEFAULT 'Anonymous',
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get('SELECT COUNT(*) as cnt FROM posts', (err, row) => {
    if (!row || row.cnt === 0) {
      const stmt = db.prepare('INSERT INTO posts (title, content, author, tags) VALUES (?, ?, ?, ?)');
      stmt.run('Getting Started with Node.js', 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine. It allows you to run JavaScript on the server side, making it perfect for building scalable web applications.', 'Alice Dev', 'nodejs,javascript,backend');
      stmt.run('Building REST APIs with Express', 'Express is a minimal and flexible Node.js web application framework. In this post, we explore how to build clean REST APIs with proper error handling and middleware.', 'Bob Coder', 'express,api,rest');
      stmt.run('SQLite for Beginners', 'SQLite is a lightweight, file-based database that requires no server setup. It\'s perfect for small to medium applications and is supported natively in Python and Node.js.', 'Carol Smith', 'sqlite,database,sql');
      stmt.run('Deploying Node Apps to the Cloud', 'Learn how to deploy your Express application to various cloud platforms including Railway, Render, and AWS. We cover environment variables, process managers, and CI/CD.', 'Alice Dev', 'deployment,cloud,devops');
      stmt.finalize();
    }
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/posts', (req, res) => {
  db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/posts/:id', (req, res) => {
  db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Post not found' });
    res.json(row);
  });
});

app.post('/api/posts', (req, res) => {
  const { title, content, author = 'Anonymous', tags = '' } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  db.run(
    'INSERT INTO posts (title, content, author, tags) VALUES (?, ?, ?, ?)',
    [title, content, author, tags],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM posts WHERE id = ?', [this.lastID], (e, row) => res.status(201).json(row));
    }
  );
});

app.put('/api/posts/:id', (req, res) => {
  const { title, content, author, tags } = req.body;
  db.run(
    'UPDATE posts SET title=?, content=?, author=?, tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, content, author, tags, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (e, row) => res.json(row));
    }
  );
});

app.delete('/api/posts/:id', (req, res) => {
  db.run('DELETE FROM posts WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Blog API running at http://localhost:${PORT}`);
  console.log(`📚 API endpoints:`);
  console.log(`   GET    /api/posts`);
  console.log(`   POST   /api/posts`);
  console.log(`   PUT    /api/posts/:id`);
  console.log(`   DELETE /api/posts/:id\n`);
});
