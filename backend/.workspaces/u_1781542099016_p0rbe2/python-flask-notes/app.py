from flask import Flask, request, jsonify, render_template
import sqlite3
import os

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'notes.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            color TEXT DEFAULT '#7c83fd',
            pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    count = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
    if count == 0:
        notes = [
            ('Meeting Notes', 'Discuss project timeline, assign tasks, review progress on Q2 goals.', '#f59e0b', 1),
            ('Shopping List', 'Milk, Eggs, Bread, Coffee, Avocados, Greek Yogurt, Berries', '#10b981', 0),
            ('Book Recommendations', 'Clean Code by Robert Martin\nThe Pragmatic Programmer\nDesign Patterns (Gang of Four)', '#7c83fd', 1),
            ('Workout Plan', 'Monday: Chest + Triceps\nWednesday: Back + Biceps\nFriday: Legs + Shoulders', '#f43f5e', 0),
            ('API Ideas', 'Build a weather API wrapper\nCreate a URL shortener service\nDesign a rate-limiting middleware', '#06b6d4', 0),
        ]
        conn.executemany('INSERT INTO notes (title, content, color, pinned) VALUES (?,?,?,?)', notes)
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes', methods=['GET'])
def get_notes():
    conn = get_db()
    rows = conn.execute('SELECT * FROM notes ORDER BY pinned DESC, created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/notes', methods=['POST'])
def create_note():
    data = request.json
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': 'title and content required'}), 400
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO notes (title, content, color, pinned) VALUES (?, ?, ?, ?)',
        (data['title'], data['content'], data.get('color', '#7c83fd'), int(data.get('pinned', 0)))
    )
    conn.commit()
    row = conn.execute('SELECT * FROM notes WHERE id = ?', (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    data = request.json
    conn = get_db()
    conn.execute(
        'UPDATE notes SET title=?, content=?, color=?, pinned=? WHERE id=?',
        (data.get('title'), data.get('content'), data.get('color', '#7c83fd'), int(data.get('pinned', 0)), note_id)
    )
    conn.commit()
    row = conn.execute('SELECT * FROM notes WHERE id = ?', (note_id,)).fetchone()
    conn.close()
    return jsonify(dict(row))

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    conn = get_db()
    conn.execute('DELETE FROM notes WHERE id = ?', (note_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    print('\n🚀 Flask Notes API running at http://localhost:5000')
    print('📝 Endpoints: GET/POST /api/notes, PUT/DELETE /api/notes/<id>\n')
    app.run(debug=True, host='0.0.0.0', port=5000)
