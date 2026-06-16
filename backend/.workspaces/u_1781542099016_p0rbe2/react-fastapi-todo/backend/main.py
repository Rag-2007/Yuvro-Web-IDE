from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os

app = FastAPI(title="Todo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "todos.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Seed data
    count = conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
    if count == 0:
        conn.executemany(
            "INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)",
            [
                ("Set up FastAPI backend", "Initialize project structure", 1),
                ("Create React frontend", "Build the UI components", 1),
                ("Connect frontend to API", "Axios/fetch integration", 0),
                ("Add authentication", "JWT tokens", 0),
                ("Deploy to production", "Docker + cloud", 0),
            ]
        )
    conn.commit()
    conn.close()

init_db()

class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = None

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None

@app.get("/")
def root():
    return {"message": "Todo API is running 🚀", "docs": "/docs"}

@app.get("/todos")
def list_todos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM todos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/todos", status_code=201)
def create_todo(todo: TodoCreate):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO todos (title, description) VALUES (?, ?)",
        (todo.title, todo.description)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM todos WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)

@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Todo not found")
    return dict(row)

@app.put("/todos/{todo_id}")
def update_todo(todo_id: int, update: TodoUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Todo not found")
    fields = {}
    if update.title is not None: fields["title"] = update.title
    if update.description is not None: fields["description"] = update.description
    if update.completed is not None: fields["completed"] = int(update.completed)
    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE todos SET {set_clause} WHERE id = ?", (*fields.values(), todo_id))
        conn.commit()
    row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    conn.close()
    return dict(row)

@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: int):
    conn = get_db()
    conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()
    return {"success": True}
