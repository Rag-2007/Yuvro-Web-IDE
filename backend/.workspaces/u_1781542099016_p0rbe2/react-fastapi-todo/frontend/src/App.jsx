import { useState, useEffect } from 'react'
import TodoItem from './components/TodoItem'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function App() {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apiOnline, setApiOnline] = useState(false)

  const fetchTodos = async () => {
    try {
      const res = await axios.get(`${API}/todos`)
      setTodos(res.data)
      setApiOnline(true)
      setError('')
    } catch {
      setError('Cannot reach FastAPI backend. Run: uvicorn main:app --reload in /backend')
      setApiOnline(false)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchTodos() }, [])

  const addTodo = async () => {
    if (!input.trim()) return
    try {
      const res = await axios.post(`${API}/todos`, { title: input.trim() })
      setTodos(prev => [res.data, ...prev])
      setInput('')
    } catch { setError('Failed to add todo') }
  }

  const toggleTodo = async (todo) => {
    try {
      const res = await axios.put(`${API}/todos/${todo.id}`, { completed: !todo.completed })
      setTodos(prev => prev.map(t => t.id === todo.id ? res.data : t))
    } catch { setError('Failed to update todo') }
  }

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API}/todos/${id}`)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch { setError('Failed to delete todo') }
  }

  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.completed
    if (filter === 'done')   return t.completed
    return true
  })

  const activeCount = todos.filter(t => !t.completed).length

  return (
    <div className="app">
      <h1>📋 React Todo</h1>
      <p className="subtitle">Full-stack: React + FastAPI + SQLite</p>

      <div className="api-badge">
        <span className={`api-dot`} style={{ background: apiOnline ? '#3fb950' : '#f85149' }} />
        FastAPI {apiOnline ? 'connected' : 'offline'} — {API}
      </div>

      <div className="add-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo…"
        />
        <button className="btn" onClick={addTodo}>Add</button>
      </div>

      <div className="filters">
        {['all','active','done'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">Loading from API…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No todos here. Add one above!</div>
      ) : (
        <div className="todo-list">
          {filtered.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
        </div>
      )}

      <div className="footer">
        <span>{activeCount} item{activeCount !== 1 ? 's' : ''} left</span>
        <button className="btn secondary" onClick={() => {
          todos.filter(t => t.completed).forEach(t => deleteTodo(t.id))
        }}>Clear completed</button>
      </div>
    </div>
  )
}
