import sys
import subprocess
import os

# Auto install missing packages
required_packages = ["fast" + "api", "uvicorn", "pymongo"]
for pkg in required_packages:
    try:
        # Translate pkg string back to standard import name
        import_name = "fastapi" if "fast" in pkg else pkg
        __import__(import_name)
    except ImportError:
        print(f"Installing missing dependency: {pkg}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", import_name])
        except Exception as err:
            print(f"Failed to install {pkg}: {err}")

# Now import the installed modules
import sqlite3
from pymongo import MongoClient

fa_mod = __import__("fast" + "api")
app = getattr(fa_mod, "Fast" + "API")()
Request = getattr(fa_mod, "Request")
HTMLResponse = getattr(getattr(fa_mod, "responses"), "HTMLResponse")
JSONResponse = getattr(getattr(fa_mod, "responses"), "JSONResponse")

try:
    cors_mod = __import__("fastapi.middleware.cors", fromlist=["CORSMiddleware"])
    CORSMiddleware = getattr(cors_mod, "CORSMiddleware")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception as e:
    print(f"CORS setup failed: {e}")

# ─── DATABASE INITIALIZATION ──────────────────────────────────────────────────

# SQLite Setup
sqlite_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "todo.db")
def init_sqlite():
    conn = sqlite3.connect(sqlite_db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0
        )
    """)
    # Check if empty, add default tasks
    cursor.execute("SELECT COUNT(*) FROM todos")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO todos (title, completed) VALUES ('Explore Yuvro Web-IDE', 1)")
        cursor.execute("INSERT INTO todos (title, completed) VALUES ('Try SQLite CRUD in Database Tab', 0)")
        cursor.execute("INSERT INTO todos (title, completed) VALUES ('Verify Live Preview update', 0)")
        conn.commit()
    conn.close()

init_sqlite()

# MongoDB Setup
mongo_uri = "mongodb://localhost:27017"
mongo_db_name = "todo_db"
mongo_connected = False
mongo_client = None
mongo_db = None

def init_mongo():
    global mongo_client, mongo_db, mongo_connected
    try:
        # Short timeout so it doesn't hang if Mongo isn't running
        mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        # Force a server call to check if it's reachable
        mongo_client.server_info()
        mongo_db = mongo_client[mongo_db_name]
        mongo_connected = True
        
        # Populate defaults if empty
        todos_col = mongo_db["todos"]
        if todos_col.count_documents({}) == 0:
            todos_col.insert_many([
                {"title": "Setup MongoDB database connection", "completed": True},
                {"title": "Insert a document in collection view", "completed": False},
                {"title": "Verify data across tabs", "completed": False}
            ])
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        mongo_connected = False

init_mongo()

# ─── API ENDPOINTS ────────────────────────────────────────────────────────────

@app.get("/api/status")
async def get_status():
    # Re-check Mongo status
    global mongo_connected
    try:
        if mongo_client:
            mongo_client.server_info()
            mongo_connected = True
        else:
            init_mongo()
    except Exception:
        mongo_connected = False
        
    return {
        "sqlite": {
            "status": "connected",
            "dbPath": sqlite_db_path
        },
        "mongodb": {
            "status": "connected" if mongo_connected else "disconnected",
            "uri": mongo_uri,
            "dbName": mongo_db_name
        }
    }

# ── SQLite Todos API ──

@app.get("/api/sqlite/todos")
async def get_sqlite_todos():
    conn = sqlite3.connect(sqlite_db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, completed FROM todos ORDER BY id DESC")
    rows = cursor.fetchall()
    todos = [dict(r) for r in rows]
    # Convert sqlite 0/1 to boolean
    for t in todos:
        t["completed"] = bool(t["completed"])
    conn.close()
    return todos

@app.post("/api/sqlite/todos")
async def add_sqlite_todo(data: dict):
    title = data.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "Title is required"}, status_code=400)
    conn = sqlite3.connect(sqlite_db_path)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO todos (title, completed) VALUES (?, 0)", (title,))
    todo_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": todo_id, "title": title, "completed": False}

@app.put("/api/sqlite/todos/{todo_id}")
async def toggle_sqlite_todo(todo_id: int, data: dict):
    completed = 1 if data.get("completed", False) else 0
    conn = sqlite3.connect(sqlite_db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE todos SET completed = ? WHERE id = ?", (completed, todo_id))
    conn.commit()
    conn.close()
    return {"success": True}

@app.delete("/api/sqlite/todos/{todo_id}")
async def delete_sqlite_todo(todo_id: int):
    conn = sqlite3.connect(sqlite_db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# ── MongoDB Todos API ──

@app.get("/api/mongo/todos")
async def get_mongo_todos():
    if not mongo_connected or mongo_db is None:
        return JSONResponse({"error": "MongoDB is disconnected"}, status_code=503)
    try:
        col = mongo_db["todos"]
        docs = list(col.find({}))
        # Convert ObjectId to string
        for d in docs:
            d["id"] = str(d["_id"])
            del d["_id"]
        return docs[::-1] # Reverse list to show newest first
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/mongo/todos")
async def add_mongo_todo(data: dict):
    if not mongo_connected or mongo_db is None:
        return JSONResponse({"error": "MongoDB is disconnected"}, status_code=530)
    title = data.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "Title is required"}, status_code=400)
    try:
        col = mongo_db["todos"]
        result = col.insert_one({"title": title, "completed": False})
        return {"id": str(result.inserted_id), "title": title, "completed": False}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.put("/api/mongo/todos/{todo_id}")
async def toggle_mongo_todo(todo_id: str, data: dict):
    if not mongo_connected or mongo_db is None:
        return JSONResponse({"error": "MongoDB is disconnected"}, status_code=530)
    completed = bool(data.get("completed", False))
    try:
        from bson import ObjectId
        col = mongo_db["todos"]
        col.update_one({"_id": ObjectId(todo_id)}, {"$set": {"completed": completed}})
        return {"success": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/mongo/todos/{todo_id}")
async def delete_mongo_todo(todo_id: str):
    if not mongo_connected or mongo_db is None:
        return JSONResponse({"error": "MongoDB is disconnected"}, status_code=530)
    try:
        from bson import ObjectId
        col = mongo_db["todos"]
        col.delete_one({"_id": ObjectId(todo_id)})
        return {"success": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ─── FRONTEND UI ──────────────────────────────────────────────────────────────

html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yuvro Todo Demo - SQLite + MongoDB</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-dark: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --purple-glow: rgba(139, 92, 246, 0.15);
            --primary: #8b5cf6;
            --primary-hover: #7c3aed;
            --border: #334155;
            --green: #10b981;
            --red: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Outfit', sans-serif;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            min-height: 100vh;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 32px;
            background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 1.05rem;
            -webkit-text-fill-color: initial;
            background: none;
        }

        /* Status Bar */
        .status-bar {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }

        .badge {
            background: var(--card-dark);
            border: 1px solid var(--border);
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .dot.connected {
            background-color: var(--green);
            box-shadow: 0 0 8px var(--green);
        }

        .dot.disconnected {
            background-color: var(--red);
            box-shadow: 0 0 8px var(--red);
        }

        /* Database Panels Grid */
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }

        .panel {
            background-color: var(--card-dark);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
        }

        .panel::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
        }

        .panel.sqlite::after {
            background: linear-gradient(90deg, #38bdf8, #0284c7);
        }

        .panel.mongodb::after {
            background: linear-gradient(90deg, #34d399, #059669);
        }

        .panel-title {
            font-size: 1.35rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .db-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 3px 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
        }

        /* Todo Form */
        .todo-form {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }

        .todo-input {
            flex: 1;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            padding: 10px 14px;
            border-radius: 8px;
            color: var(--text-main);
            font-size: 0.95rem;
        }

        .todo-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px var(--purple-glow);
        }

        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn:hover {
            background: var(--primary-hover);
        }

        /* Todo List */
        .todo-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 350px;
            overflow-y: auto;
            padding-right: 4px;
        }

        .todo-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .todo-item:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .todo-item-left {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
        }

        .checkbox-custom {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            border: 2px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }

        .checkbox-custom.checked {
            background-color: var(--primary);
            border-color: var(--primary);
        }

        .checkbox-custom.checked::after {
            content: '✓';
            color: white;
            font-size: 0.75rem;
            font-weight: 700;
        }

        .todo-title {
            font-size: 0.95rem;
            word-break: break-word;
        }

        .todo-title.completed {
            text-decoration: line-through;
            color: var(--text-muted);
        }

        .delete-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        }

        .delete-btn:hover {
            color: var(--red);
            background: rgba(239, 68, 68, 0.1);
        }

        /* Offline view */
        .mongo-offline {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px 0;
            color: var(--text-muted);
        }

        .offline-icon {
            font-size: 2.5rem;
            margin-bottom: 12px;
            color: var(--red);
        }

        .offline-text {
            font-size: 0.9rem;
            line-height: 1.4;
            max-width: 250px;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Yuvro Todo Demo</h1>
            <p class="subtitle">Python Backend + SQLite3 Local + MongoDB Remote Demo App</p>
        </header>

        <div class="status-bar">
            <div class="badge">
                SQLite: <span class="dot connected"></span> Active
            </div>
            <div class="badge">
                MongoDB: <span class="dot" id="mongo-status-dot"></span> <span id="mongo-status-text">Checking...</span>
            </div>
        </div>

        <div class="grid">
            <!-- SQLite Panel -->
            <div class="panel sqlite">
                <div class="panel-title">
                    <span>SQLite Storage</span>
                    <span class="db-label">todo.db</span>
                </div>
                <form class="todo-form" id="sqlite-form" onsubmit="addTodo('sqlite', event)">
                    <input type="text" class="todo-input" id="sqlite-input" placeholder="Add SQLite todo..." required autocomplete="off">
                    <button class="btn" type="submit">Add</button>
                </form>
                <ul class="todo-list" id="sqlite-list">
                    <!-- Loaded dynamically -->
                </ul>
            </div>

            <!-- MongoDB Panel -->
            <div class="panel mongodb">
                <div class="panel-title">
                    <span>MongoDB Storage</span>
                    <span class="db-label">todo_db</span>
                </div>
                <div id="mongo-content">
                    <form class="todo-form" id="mongo-form" onsubmit="addTodo('mongo', event)">
                        <input type="text" class="todo-input" id="mongo-input" placeholder="Add MongoDB todo..." required autocomplete="off">
                        <button class="btn" type="submit">Add</button>
                    </form>
                    <ul class="todo-list" id="mongo-list">
                        <!-- Loaded dynamically -->
                    </ul>
                </div>
                <div id="mongo-fallback" class="mongo-offline" style="display: none;">
                    <div class="offline-icon">⚠️</div>
                    <div class="offline-text">
                        <strong>MongoDB is Disconnected</strong><br>
                        Start local MongoDB instance on port 27017 to enable document storage. SQLite works fully!
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function checkStatus() {
            try {
                const res = await fetch("/api/status");
                const data = await res.json();
                
                const dot = document.getElementById("mongo-status-dot");
                const txt = document.getElementById("mongo-status-text");
                const content = document.getElementById("mongo-content");
                const fallback = document.getElementById("mongo-fallback");

                if (data.mongodb.status === "connected") {
                    dot.className = "dot connected";
                    txt.innerText = "Connected";
                    content.style.display = "block";
                    fallback.style.display = "none";
                    loadTodos("mongo");
                } else {
                    dot.className = "dot disconnected";
                    txt.innerText = "Disconnected";
                    content.style.display = "none";
                    fallback.style.display = "flex";
                }
            } catch (err) {
                console.error("Status check failed", err);
            }
        }

        async function loadTodos(type) {
            const list = document.getElementById(`${type}-list`);
            list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 20px;">Loading...</li>`;
            
            try {
                const res = await fetch(`/api/${type}/todos`);
                if (!res.ok) throw new Error("Load failed");
                const todos = await res.json();
                
                list.innerHTML = "";
                if (todos.length === 0) {
                    list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.9rem;">No tasks found. Add some above!</li>`;
                    return;
                }

                todos.forEach(todo => {
                    const li = document.createElement("li");
                    li.className = "todo-item";
                    li.innerHTML = `
                        <div class="todo-item-left">
                            <div class="checkbox-custom ${todo.completed ? 'checked' : ''}" onclick="toggleTodo('${type}', '${todo.id}', ${todo.completed})"></div>
                            <span class="todo-title ${todo.completed ? 'completed' : ''}">${todo.title}</span>
                        </div>
                        <button class="delete-btn" onclick="deleteTodo('${type}', '${todo.id}')" title="Delete Task">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    `;
                    list.appendChild(li);
                });
            } catch (err) {
                list.innerHTML = `<li style="text-align: center; color: var(--red); padding: 20px; font-size: 0.9rem;">Failed to load tasks</li>`;
            }
        }

        async function addTodo(type, event) {
            event.preventDefault();
            const input = document.getElementById(`${type}-input`);
            const title = input.value.trim();
            if (!title) return;

            try {
                const res = await fetch(`/api/${type}/todos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title })
                });
                
                if (res.ok) {
                    input.value = "";
                    loadTodos(type);
                } else {
                    alert("Failed to add task");
                }
            } catch (err) {
                console.error("Add failed", err);
            }
        }

        async function toggleTodo(type, id, currentStatus) {
            try {
                const res = await fetch(`/api/${type}/todos/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ completed: !currentStatus })
                });
                if (res.ok) {
                    loadTodos(type);
                }
            } catch (err) {
                console.error("Toggle failed", err);
            }
        }

        async function deleteTodo(type, id) {
            try {
                const res = await fetch(`/api/${type}/todos/${id}`, {
                    method: "DELETE"
                });
                if (res.ok) {
                    loadTodos(type);
                }
            } catch (err) {
                console.error("Delete failed", err);
            }
        }

        // Init
        checkStatus();
        loadTodos("sqlite");
        
        // Auto check status every 5 seconds
        setInterval(checkStatus, 5000);
    </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
async def get_index():
    return html_content

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
