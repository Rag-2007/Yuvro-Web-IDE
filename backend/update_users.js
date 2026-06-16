const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');
const path = require('path');

const db = new sqlite3.Database(path.join(process.cwd(), '.workspaces/yuvro_users.db'));

async function reset() {
  const hash = await bcrypt.hash('password123', 10);
  
  // Update demo2
  db.run('UPDATE users SET passwordHash = ? WHERE email = ?', [hash, 'demo2@yuvro.dev']);
  
  // Create user1
  db.run('DELETE FROM users WHERE email = ?', ['user1@yuvro.dev'], () => {
    const id = `u_${Date.now()}_user1`;
    const createdAt = new Date().toISOString();
    db.run('INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)', [id, 'user1@yuvro.dev', hash, createdAt], () => {
      console.log('Users updated successfully.');
    });
  });
}
reset();
