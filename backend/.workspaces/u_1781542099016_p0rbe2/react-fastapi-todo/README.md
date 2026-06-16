# React + FastAPI Todo App

A full-stack todo application with a **React** frontend and **FastAPI** Python backend, backed by **SQLite**.

## Project Structure
```
react-fastapi-todo/
├── frontend/                 ← React (Vite) app
│   ├── src/
│   │   ├── App.jsx           ← Main component
│   │   ├── main.jsx          ← React entry point
│   │   ├── index.css         ← Global styles
│   │   └── components/
│   │       └── TodoItem.jsx  ← Todo item component
│   ├── index.html
│   └── package.json
├── backend/                  ← FastAPI Python API
│   ├── main.py               ← API routes + SQLite logic
│   ├── todos.db              ← SQLite database (auto-created)
│   └── requirements.txt
└── README.md
```

## Running Locally

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /todos   | List all todos |
| POST   | /todos   | Create a todo |
| GET    | /todos/{id} | Get one todo |
| PUT    | /todos/{id} | Update a todo |
| DELETE | /todos/{id} | Delete a todo |

## Tech Stack
| Layer    | Technology |
|----------|-----------|
| Frontend | React 18 + Vite |
| Backend  | FastAPI (Python) |
| Database | SQLite (via Python sqlite3) |
| Styling  | Vanilla CSS |
