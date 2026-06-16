export default function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className="todo-item">
      <button
        className={`check-btn ${todo.completed ? 'done' : ''}`}
        onClick={() => onToggle(todo)}
        title={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.completed ? '✓' : ''}
      </button>
      <div style={{ flex: 1 }}>
        <div className={`todo-text ${todo.completed ? 'done' : ''}`}>{todo.title}</div>
        {todo.description && (
          <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '0.15rem' }}>
            {todo.description}
          </div>
        )}
      </div>
      <button className="del-btn" onClick={() => onDelete(todo.id)} title="Delete">✕</button>
    </div>
  )
}
