import { useState, useEffect } from 'react';
import { getProjects, deleteProject, createProject, cloneProject, uploadProject, createFile, executeQuery, addConnection } from '../api';
import { useAuth } from '../context/AuthContext';
import { Folder, Plus, GitBranch, Upload, ChevronRight, ArrowLeft, Trash2, LogOut, User } from 'lucide-react';
import QuickInput from '../components/QuickInput';

export default function Dashboard({ onSelectProject }: { onSelectProject: (name: string) => void }) {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'clone' | 'upload'>('list');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add Database flow state
  const [addDb, setAddDb] = useState(false);
  const [dbType, setDbType] = useState<'sqlite' | 'mysql' | 'postgresql' | 'mongodb'>('sqlite');
  const [sqliteName, setSqliteName] = useState('project.db');
  const [dbConnName, setDbConnName] = useState('My DB');
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPort, setDbPort] = useState(3306);
  const [dbDatabase, setDbDatabase] = useState('');
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbMongoUri, setDbMongoUri] = useState('mongodb://localhost:27017');

  const loadProjects = () => {
    getProjects().then(data => setProjects(data)).catch(() => setProjects([]));
  };

  useEffect(() => { loadProjects(); }, []);

  const resetForm = () => {
    setProjectName('');
    setRepoUrl('');
    setFile(null);
    setError('');
    setAddDb(false);
    setDbType('sqlite');
    setSqliteName('project.db');
    setDbConnName('My DB');
    setDbHost('localhost');
    setDbPort(3306);
    setDbDatabase('');
    setDbUser('root');
    setDbPassword('');
    setDbMongoUri('mongodb://localhost:27017');
  };

  const handleCreate = async () => {
    const pName = projectName.trim();
    if (!pName) return;
    setLoading(true); setError('');
    try {
      await createProject(pName);
      
      if (addDb) {
        if (dbType === 'sqlite') {
          const dbName = sqliteName.trim() || 'project.db';
          const dbB64 = btoa(dbName);
          await createFile(pName, dbB64);
          try {
            await executeQuery(pName, dbB64, "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, completed INTEGER DEFAULT 0)");
            await executeQuery(pName, dbB64, "INSERT INTO tasks (title, completed) VALUES ('Verify IDE features', 0), ('Show database connections', 1)");
          } catch (e) {
            console.error('Failed to pre-seed SQLite table:', e);
          }
        } else if (dbType === 'mysql' || dbType === 'postgresql') {
          await addConnection(pName, {
            name: dbConnName.trim() || 'My External DB',
            type: dbType,
            host: dbHost.trim() || 'localhost',
            port: Number(dbPort),
            database: dbDatabase.trim(),
            user: dbUser.trim(),
            password: dbPassword,
          });
        } else if (dbType === 'mongodb') {
          await addConnection(pName, {
            name: dbConnName.trim() || 'My Mongo DB',
            type: 'mongodb',
            uri: dbMongoUri.trim() || 'mongodb://localhost:27017',
            dbName: dbDatabase.trim() || 'admin',
          });
        }
      }
      onSelectProject(pName);
    }
    catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create project. Name may already exist.');
    }
    setLoading(false);
  };

  const handleClone = async () => {
    if (!projectName.trim() || !repoUrl.trim()) return;
    setLoading(true); setError('');
    try { await cloneProject(projectName.trim(), repoUrl.trim()); onSelectProject(projectName.trim()); }
    catch { setError('Failed to clone. Check the repository URL and try again.'); }
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!projectName.trim() || !file) return;
    setLoading(true); setError('');
    try { await uploadProject(projectName.trim(), file); onSelectProject(projectName.trim()); }
    catch { setError('Failed to upload project. Ensure it is a valid zip file.'); }
    setLoading(false);
  };

  const handleDeleteClick = (name: string, e: React.MouseEvent) => { e.stopPropagation(); setDeleteTarget(name); };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try { await deleteProject(deleteTarget); loadProjects(); } catch {}
    setDeleteTarget(null);
  };

  const initials = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <div className="dashboard">
      <QuickInput
        isOpen={deleteTarget !== null}
        type="confirm"
        title="Delete Project"
        message={`Delete "${deleteTarget}"? This will permanently remove all files and folders inside it.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <img src="/yuvro.png" alt="Yuvro Logo" className="dashboard-logo-img" />
          <div className="dashboard-logo-text">
            <span className="dashboard-logo-brand">Yuvro</span>
            <span className="dashboard-logo-product">Web-IDE</span>
          </div>
        </div>
        <div className="dashboard-user-bar">
          <div className="dashboard-user-info">
            <div className="dashboard-avatar">{initials}</div>
            <div className="dashboard-user-details">
              <span className="dashboard-user-email">{user?.email}</span>
              <span className="dashboard-user-label">Developer</span>
            </div>
          </div>
          <button
            id="dashboard-logout-btn"
            className="dashboard-logout-btn"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      <p className="dashboard-subtitle">A full-featured browser-based development environment</p>

      <div className="dashboard-card">
        {view === 'list' && (
          <>
            <div className="dashboard-actions">
              <div className="action-card" onClick={() => { resetForm(); setView('create'); }}>
                <Plus size={24} />
                <span>New Project</span>
              </div>
              <div className="action-card" onClick={() => { resetForm(); setView('clone'); }}>
                <GitBranch size={24} />
                <span>Clone Repo</span>
              </div>
              <div className="action-card" onClick={() => { resetForm(); setView('upload'); }}>
                <Upload size={24} />
                <span>Upload ZIP</span>
              </div>
            </div>

            <div className="section-title">
              <User size={14} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
              My Projects
            </div>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                No projects yet. Create one above to get started.
              </p>
            ) : (
              <ul className="project-list">
                {projects.map(p => (
                  <li key={p.name} className="project-item" onClick={() => onSelectProject(p.name)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Folder size={18} color="var(--accent)" />
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="project-delete-btn" title="Delete project" onClick={(e) => handleDeleteClick(p.name, e)}>
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={16} color="var(--text-dim)" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view === 'create' && (
          <div>
            <button className="back-btn" onClick={() => setView('list')}><ArrowLeft size={14} /> Back</button>
            <div className="section-title">Create Blank Project</div>
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Project Name</label>
              <input className="input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="my-new-project" onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
            </div>

            {/* Optional Database Section */}
            <div style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={addDb} onChange={e => setAddDb(e.target.checked)} style={{ cursor: 'pointer' }} />
                <span>Initialize Project with Database</span>
              </label>

              {addDb && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div className="form-group">
                    <label>Database Type</label>
                    <select className="input" value={dbType} onChange={e => {
                      const t = e.target.value as any;
                      setDbType(t);
                      if (t === 'mysql') setDbPort(3306);
                      else if (t === 'postgresql') setDbPort(5432);
                    }} style={{ width: '100%' }}>
                      <option value="sqlite">SQLite (local file)</option>
                      <option value="mysql">MySQL (external)</option>
                      <option value="postgresql">PostgreSQL (external)</option>
                      <option value="mongodb">MongoDB (external)</option>
                    </select>
                  </div>

                  {dbType === 'sqlite' && (
                    <div className="form-group">
                      <label>Database File Name</label>
                      <input className="input" value={sqliteName} onChange={e => setSqliteName(e.target.value)} placeholder="project.db" />
                    </div>
                  )}

                  {(dbType === 'mysql' || dbType === 'postgresql') && (
                    <>
                      <div className="form-group">
                        <label>Connection Name</label>
                        <input className="input" value={dbConnName} onChange={e => setDbConnName(e.target.value)} placeholder="e.g. My External DB" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '0.5rem' }}>
                        <div className="form-group">
                          <label>Host</label>
                          <input className="input" value={dbHost} onChange={e => setDbHost(e.target.value)} placeholder="localhost" />
                        </div>
                        <div className="form-group">
                          <label>Port</label>
                          <input className="input" type="number" value={dbPort} onChange={e => setDbPort(Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Database Name</label>
                        <input className="input" value={dbDatabase} onChange={e => setDbDatabase(e.target.value)} placeholder="mydb" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="form-group">
                          <label>User</label>
                          <input className="input" value={dbUser} onChange={e => setDbUser(e.target.value)} placeholder="root" />
                        </div>
                        <div className="form-group">
                          <label>Password</label>
                          <input className="input" type="password" value={dbPassword} onChange={e => setDbPassword(e.target.value)} placeholder="password" />
                        </div>
                      </div>
                    </>
                  )}

                  {dbType === 'mongodb' && (
                    <>
                      <div className="form-group">
                        <label>Connection Name</label>
                        <input className="input" value={dbConnName} onChange={e => setDbConnName(e.target.value)} placeholder="e.g. My MongoDB Connection" />
                      </div>
                      <div className="form-group">
                        <label>Connection URI</label>
                        <input className="input" value={dbMongoUri} onChange={e => setDbMongoUri(e.target.value)} placeholder="mongodb://localhost:27017" />
                      </div>
                      <div className="form-group">
                        <label>Database Name</label>
                        <input className="input" value={dbDatabase} onChange={e => setDbDatabase(e.target.value)} placeholder="mydb" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {error && <div className="db-error" style={{ margin: '0.75rem 0' }}>{error}</div>}
            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button className="button" onClick={handleCreate} disabled={loading || !projectName.trim()}>{loading ? 'Creating...' : 'Create Project'}</button>
              <button className="button secondary" onClick={() => setView('list')}>Cancel</button>
            </div>
          </div>
        )}

        {view === 'clone' && (
          <div>
            <button className="back-btn" onClick={() => setView('list')}><ArrowLeft size={14} /> Back</button>
            <div className="section-title">Clone Repository</div>
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Project Name</label>
              <input className="input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="my-cloned-project" autoFocus />
            </div>
            <div className="form-group">
              <label>Repository URL</label>
              <input className="input" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/username/repo.git" onKeyDown={e => { if (e.key === 'Enter') handleClone(); }} />
            </div>
            {error && <div className="db-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div className="spinner" style={{ width: 14, height: 14 }} /> Cloning repository…</div>}
            <div className="form-actions">
              <button className="button" onClick={handleClone} disabled={loading || !projectName.trim() || !repoUrl.trim()}>{loading ? 'Cloning...' : 'Clone Repository'}</button>
              <button className="button secondary" onClick={() => setView('list')}>Cancel</button>
            </div>
          </div>
        )}

        {view === 'upload' && (
          <div>
            <button className="back-btn" onClick={() => setView('list')}><ArrowLeft size={14} /> Back</button>
            <div className="section-title">Upload Project ZIP</div>
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Project Name</label>
              <input className="input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="my-uploaded-project" autoFocus />
            </div>
            <div className="form-group">
              <label>Select ZIP File</label>
              <input type="file" className="input" accept=".zip" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {error && <div className="db-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <div className="form-actions">
              <button className="button" onClick={handleUpload} disabled={loading || !projectName.trim() || !file}>{loading ? 'Uploading...' : 'Upload Project'}</button>
              <button className="button secondary" onClick={() => setView('list')}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
