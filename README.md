# YUVRO AI - Web IDE Platform

Welcome to **YUVRO AI**, a powerful, cloud-based Integrated Development Environment (IDE) built for the web. YUVRO AI allows users to manage multiple projects from a central dashboard, edit code in a feature-rich browser editor, execute scripts in an integrated terminal, inspect database tables, and view their running applications in real-time.

---

## 🌟 Key Features

- **Project Dashboard**: A central hub to manage, create, clone, and upload projects.
- **Email/Password Authentication**: Secure JWT-based registration and login system with bcrypt hashing on the backend.
- **Tenant-Isolated Workspaces**: Projects are organized dynamically on the backend under namespaced folder paths per user (`backend/.workspaces/<userId>/`).
- **Web-Based Code Editor**: Powered by Monaco Editor for a syntax-highlighted coding experience.
- **Integrated Terminal**: Fully interactive pseudo-terminal (PTY) using `node-pty` and xterm.js to install dependencies, run migrations, and execute test cases.
- **Multi-Database Browser & CRUD**: 
  - **SQLite**: Automatic database file detection, table/schema viewer, row insert/delete actions, and a read-only custom SQL query runner.
  - **MongoDB**: Connect to external MongoDB servers, view list of collections, and add or delete documents directly.
- **Frontend Live Preview**: Integrated side-by-side browser frame displaying the running application with automated port detection, live refresh, and navigation links.

---

## 🏗️ Architecture & Data Flow

YUVRO AI follows a secure client-server proxy architecture. The client does not talk directly to databases or terminal processes; all queries and terminal inputs are piped securely through the NestJS backend API.

```mermaid
graph TD
    Client[Frontend: React/Vite IDE] -->|REST APIs + JWT| API[Backend: NestJS API]
    Client -->|WebSockets| PTY[Backend: Terminal/PTY Manager]
    
    API -->|Read/Write Files| FS[(File System Workspace)]
    API -->|SQLite Query / CRUD| SQLite[(SQLite Database Files)]
    API -->|MongoDB Query / CRUD| Mongo[(MongoDB Instance)]
    PTY -->|Spawn Process Group| OS[(Host OS / Shell)]
    
    subgraph Storage & Namespaces (.workspaces/<userId>/)
        FS
        SQLite
    end
    
    subgraph External Connections
        Mongo
    end
```

### 1. User Isolation & Directory Structures
When a user authenticates, their database paths are mapped to namespaced project sandboxes:
```
backend/.workspaces/
├── yuvro_users.db                # Global user database
├── u_1781542099016_p0rbe2/       # User A Workspace
│   └── todo_python/              # User A Project
│       ├── _yuvro_db.json        # Database Connection Configuration
│       └── todo.db               # SQLite DB
└── u_9876543210987_a1b2c3/       # User B Workspace
```

### 2. Multi-Database Connections (`_yuvro_db.json`)
Each workspace stores its connection details inside the project folder:
```json
[
  {
    "id": "conn_sqlite_todo",
    "name": "SQLite Todo DB",
    "type": "sqlite",
    "filePath": "todo.db"
  },
  {
    "id": "conn_mongodb_todo",
    "name": "MongoDB Todo DB",
    "type": "mongodb",
    "uri": "mongodb://localhost:27017",
    "dbName": "todo_db"
  }
]
```

---

## 💻 Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Code Editor**: `@monaco-editor/react`
- **Terminal UI**: `@xterm/xterm` (with PTY integration)
- **Grid Layouts**: Custom responsive vanilla CSS design systems.
- **Real-Time Comm**: `socket.io-client`

### Backend
- **Framework**: NestJS (Node.js) + TypeScript
- **Authentication**: `@nestjs/jwt`, `passport`, `bcrypt`
- **Database Drivers**: `sqlite3`, `mongodb`
- **Real-Time Comm**: Socket.IO / WebSockets (via NestJS Gateways)
- **OS Integration**: `node-pty` for terminal sessions.

---

## 🚀 Getting Started

### Prerequisites
Make sure **Docker Desktop** is running if you want to test the MongoDB connection locally.
```bash
# Start a local MongoDB container
docker run -d --name local-mongo -p 27017:27017 mongo:latest
```

### 1. Start the Backend
```bash
cd backend
npm install
# Clean TS build cache and compile
rm -f tsconfig.build.tsbuildinfo tsconfig.tsbuildinfo && npm run build
# Start production server
npm run start:prod
```
*The backend runs on `http://localhost:3000`.*

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*The frontend runs on `http://localhost:5173`.*

Open `http://localhost:5173` in your browser, register a test account, open your project, and start development!
