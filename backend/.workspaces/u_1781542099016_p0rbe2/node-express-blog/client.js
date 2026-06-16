const API = '/api';

async function loadPosts() {
  const container = document.getElementById('posts');
  container.innerHTML = '<div class="loading">Loading posts…</div>';
  try {
    const res = await fetch(`${API}/posts`);
    const posts = await res.json();
    if (posts.length === 0) {
      container.innerHTML = '<div class="empty">No posts yet. Create your first one!</div>';
      return;
    }
    container.innerHTML = posts.map(p => `
      <div class="post-card" id="post-${p.id}">
        <div class="post-title">${escHtml(p.title)}</div>
        <div class="post-meta">
          <span>✍️ ${escHtml(p.author || 'Anonymous')}</span>
          <span>🕒 ${new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        <div class="post-content">${escHtml(p.content)}</div>
        ${p.tags ? `<div class="tags">${p.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('')}</div>` : ''}
        <div class="post-actions">
          <button class="btn danger" onclick="deletePost(${p.id})">Delete</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = '<div class="empty">⚠️ Cannot reach server. Run: node server.js</div>';
  }
}

async function submitPost() {
  const title   = document.getElementById('f-title').value.trim();
  const author  = document.getElementById('f-author').value.trim();
  const tags    = document.getElementById('f-tags').value.trim();
  const content = document.getElementById('f-content').value.trim();
  if (!title || !content) return alert('Title and content required');
  await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, author, tags, content })
  });
  hideForm();
  loadPosts();
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  await fetch(`${API}/posts/${id}`, { method: 'DELETE' });
  loadPosts();
}

function showForm() { document.getElementById('form-panel').classList.remove('hidden'); }
function hideForm() {
  document.getElementById('form-panel').classList.add('hidden');
  ['f-title','f-author','f-tags','f-content'].forEach(id => document.getElementById(id).value = '');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadPosts();
