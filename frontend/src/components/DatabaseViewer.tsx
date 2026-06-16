import { useState, useEffect, useRef, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
import {
  getTables, getSchema, getDbFiles, executeQuery,
  sqliteInsert, sqliteDelete,
  getConnections, addConnection, removeConnection,
  mongoCollections, mongoFind, mongoInsert, mongoDelete, mongoTest,
  externalDbTest, externalDbTables, externalDbQuery,
} from '../api';
import {
  Database, Play, Table2, RefreshCw, ChevronRight, ChevronDown,
  Hash, Type, AlertCircle, Loader, Plus, Trash2, Save, X,
  Layers, Link2, Check,
} from 'lucide-react';

// ─── Error Boundary ───────────────────────────────────────────────────────────
class DBErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error?.message || error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={28} />
          <strong>Database panel error</strong>
          <small style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>{this.state.error}</small>
          <button className="button" style={{ marginTop: 8 }} onClick={() => this.setState({ hasError: false, error: '' })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Simple Data Grid ────────────────────────────────────────────────────────
function DataGrid({ rows, columns, onDelete }: {
  rows: Record<string, unknown>[];
  columns: { field: string; headerName: string }[];
  onDelete?: (row: Record<string, unknown>) => void;
}) {
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');
  const PAGE_SIZE = 50;

  const filtered = rows.filter(row =>
    !filter || Object.values(row).some(v => String(v ?? '').toLowerCase().includes(filter.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(a[sortCol] ?? '');
    const vb = String(b[sortCol] ?? '');
    return sortDir === 'asc' ? va.localeCompare(vb, undefined, { numeric: true }) : vb.localeCompare(va, undefined, { numeric: true });
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(0);
  };

  if (columns.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1, maxWidth: 260, fontSize: '0.8rem', padding: '4px 8px' }}
          placeholder="Filter rows…"
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0); }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-dark)', position: 'sticky', top: 0, zIndex: 1 }}>
              {columns.map(col => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  style={{ padding: '6px 10px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  {col.headerName} {sortCol === col.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              {onDelete && <th style={{ width: 36, borderBottom: '1px solid var(--border)' }}></th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length + (onDelete ? 1 : 0)} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No rows</td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                {columns.map(col => (
                  <td key={col.field} style={{ padding: '5px 10px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                    {row[col.field] === null || row[col.field] === undefined ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span> : String(row[col.field])}
                  </td>
                ))}
                {onDelete && (
                  <td style={{ padding: '2px 6px' }}>
                    <button onClick={() => onDelete(row)} title="Delete row" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 3, lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <button className="button secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
          Page {page + 1} / {totalPages}
          <button className="button secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

interface ColumnInfo { cid: number; name: string; type: string; notnull: number; pk: number; }
interface TableSchema { name: string; columns: ColumnInfo[]; expanded: boolean; }
interface DbConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'mongodb' | 'mysql' | 'postgresql';
  filePath?: string;
  uri?: string;
  dbName?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  createdAt: string;
}

interface DatabaseViewerProps { projectName: string; }

// ─── Add Row Modal ────────────────────────────────────────────────────────────
function AddRowModal({ columns, onSave, onClose }: {
  columns: ColumnInfo[];
  onSave: (data: Record<string, any>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const editableCols = columns.filter(c => c.pk !== 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Plus size={14} /> <span>Add Row</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {editableCols.map(col => (
            <div className="modal-field" key={col.name}>
              <label>{col.name} <span className="modal-col-type">{col.type || 'ANY'}</span></label>
              <input
                className="input"
                placeholder={`Enter ${col.name}`}
                value={form[col.name] || ''}
                onChange={e => setForm(f => ({ ...f, [col.name]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="button" onClick={() => onSave(form)}>
            <Save size={13} /> Insert Row
          </button>
          <button className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add MongoDB Connection Modal ─────────────────────────────────────────────
function AddMongoModal({ projectName, onSave, onClose }: {
  projectName: string;
  onSave: (conn: DbConnection) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [uri, setUri] = useState('mongodb://localhost:27017');
  const [dbName, setDbName] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await mongoTest(projectName, uri);
      setTestResult({ ok: true, msg: `Connected! Databases: ${res.databases.join(', ')}` });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.response?.data?.message || 'Connection failed' });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !uri.trim() || !dbName.trim()) return;
    try {
      const conn = await addConnection(projectName, { name: name.trim(), type: 'mongodb', uri: uri.trim(), dbName: dbName.trim() });
      onSave(conn);
    } catch {}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-header">
          <Link2 size={14} /> <span>Add MongoDB Connection</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>Connection Name</label>
            <input className="input" placeholder="e.g. My Mongo DB" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>MongoDB URI</label>
            <input className="input" placeholder="mongodb://localhost:27017" value={uri} onChange={e => setUri(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Database Name</label>
            <input className="input" placeholder="mydb" value={dbName} onChange={e => setDbName(e.target.value)} />
          </div>
          {testResult && (
            <div className={`modal-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
              {testResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="button secondary" onClick={handleTest} disabled={testing}>
            {testing ? <Loader size={13} className="spin" /> : <Link2 size={13} />}
            Test Connection
          </button>
          <button className="button" onClick={handleSave} disabled={!name.trim() || !uri.trim() || !dbName.trim()}>
            <Save size={13} /> Save Connection
          </button>
          <button className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add External Database Connection Modal ──────────────────────────────────
function AddExternalDbModal({ projectName, onSave, onClose }: {
  projectName: string;
  onSave: (conn: DbConnection) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'mysql' | 'postgresql'>('mysql');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTypeChange = (newType: 'mysql' | 'postgresql') => {
    setType(newType);
    setPort(newType === 'mysql' ? 3306 : 5432);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const connData = { type, host, port: Number(port), database, user, password };
      const res = await externalDbTest(projectName, connData);
      setTestResult({ ok: true, msg: res.message || 'Connected successfully!' });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.response?.data?.message || 'Connection failed' });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !host.trim() || !database.trim() || !user.trim()) return;
    try {
      const conn = await addConnection(projectName, {
        name: name.trim(),
        type,
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        user: user.trim(),
        password,
      });
      onSave(conn);
    } catch {}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-header">
          <Link2 size={14} /> <span>Add External Database</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>Connection Name</label>
            <input className="input" placeholder="e.g. Production MySQL" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Database Type</label>
            <select className="input" style={{ width: '100%' }} value={type} onChange={e => handleTypeChange(e.target.value as any)}>
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Host</label>
            <input className="input" placeholder="localhost" value={host} onChange={e => setHost(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Port</label>
            <input className="input" type="number" placeholder={type === 'mysql' ? '3306' : '5432'} value={port} onChange={e => setPort(Number(e.target.value))} />
          </div>
          <div className="modal-field">
            <label>Database Name</label>
            <input className="input" placeholder="mydb" value={database} onChange={e => setDatabase(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>User</label>
            <input className="input" placeholder="root" value={user} onChange={e => setUser(e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Password</label>
            <input className="input" type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {testResult && (
            <div className={`modal-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
              {testResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="button secondary" onClick={handleTest} disabled={testing}>
            {testing ? <Loader size={13} className="spin" /> : <Link2 size={13} />}
            Test Connection
          </button>
          <button className="button" onClick={handleSave} disabled={!name.trim() || !host.trim() || !database.trim() || !user.trim()}>
            <Save size={13} /> Save Connection
          </button>
          <button className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Mongo Document Modal ─────────────────────────────────────────────────
function AddMongoDocModal({ onSave, onClose }: { onSave: (doc: Record<string, any>) => void; onClose: () => void }) {
  const [json, setJson] = useState('{\n  \n}');
  const [error, setError] = useState('');

  const handleSave = () => {
    try {
      const doc = JSON.parse(json);
      onSave(doc);
    } catch { setError('Invalid JSON'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-header">
          <Plus size={14} /> <span>Insert Document</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>JSON Document</label>
          <textarea
            className="dbv-query-editor"
            value={json}
            onChange={e => { setJson(e.target.value); setError(''); }}
            rows={8}
            spellCheck={false}
          />
          {error && <div className="modal-test-result fail"><AlertCircle size={12} /><span>{error}</span></div>}
        </div>
        <div className="modal-footer">
          <button className="button" onClick={handleSave}><Save size={13} /> Insert</button>
          <button className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main DatabaseViewer ──────────────────────────────────────────────────────
export default function DatabaseViewer({ projectName }: DatabaseViewerProps) {
  const [dbTab, setDbTab] = useState<'sqlite' | 'mongodb' | 'external'>('sqlite');

  // SQLite state
  const [dbFiles, setDbFiles] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [schemas, setSchemas] = useState<TableSchema[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rowData, setRowData] = useState<Record<string, unknown>[]>([]);
  const [colDefs, setColDefs] = useState<Record<string, unknown>[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<Record<string, unknown>[]>([]);
  const [queryColDefs, setQueryColDefs] = useState<Record<string, unknown>[]>([]);
  const [queryError, setQueryError] = useState('');
  const [runningQuery, setRunningQuery] = useState(false);
  const [queryMode, setQueryMode] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [crudMsg, setCrudMsg] = useState('');
  const queryRef = useRef<HTMLTextAreaElement>(null);

  // MongoDB state
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<DbConnection | null>(null);
  const [mongoColls, setMongoColls] = useState<string[]>([]);
  const [selectedColl, setSelectedColl] = useState<string>('');
  const [mongoDocs, setMongoDocs] = useState<any[]>([]);
  const [mongoColDefs, setMongoColDefs] = useState<Record<string, unknown>[]>([]);
  const [loadingMongo, setLoadingMongo] = useState(false);
  const [mongoError, setMongoError] = useState('');
  const [showAddMongo, setShowAddMongo] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);

  // External DB state
  const [extConnections, setExtConnections] = useState<DbConnection[]>([]);
  const [selectedExtConn, setSelectedExtConn] = useState<DbConnection | null>(null);
  const [extTables, setExtTables] = useState<string[]>([]);
  const [selectedExtTable, setSelectedExtTable] = useState<string>('');
  const [extRowData, setExtRowData] = useState<Record<string, unknown>[]>([]);
  const [extColDefs, setExtColDefs] = useState<Record<string, unknown>[]>([]);
  const [loadingExt, setLoadingExt] = useState(false);
  const [extError, setExtError] = useState('');
  const [showAddExt, setShowAddExt] = useState(false);
  const [extQuery, setExtQuery] = useState('');
  const [extQueryResult, setExtQueryResult] = useState<Record<string, unknown>[]>([]);
  const [extQueryColDefs, setExtQueryColDefs] = useState<Record<string, unknown>[]>([]);
  const [extQueryMode, setExtQueryMode] = useState(false);
  const [runningExtQuery, setRunningExtQuery] = useState(false);

  const dbBase64 = selectedDb ? btoa(selectedDb) : '';

  // ── SQLite: scan db files ─────────────────────────────────────────────────
  const refreshDbFiles = useCallback(async () => {
    setLoadingDbs(true);
    try {
      const files: string[] = await getDbFiles(projectName);
      setDbFiles(files);
      if (files.length > 0 && !selectedDb) setSelectedDb(files[0]);
    } catch { setDbFiles([]); }
    setLoadingDbs(false);
  }, [projectName, selectedDb]);

  useEffect(() => { refreshDbFiles(); }, [projectName]);

  // ── SQLite: load schema when db changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedDb) return;
    setSchemas([]); setSelectedTable(''); setRowData([]); setColDefs([]); setQueryMode(false); setQuery('');
    const load = async () => {
      setLoadingSchema(true);
      try {
        const tables: string[] = await getTables(projectName, btoa(selectedDb));
        const loaded: TableSchema[] = await Promise.all(
          tables.map(async (name) => {
            try {
              const cols: ColumnInfo[] = await getSchema(projectName, name, btoa(selectedDb));
              return { name, columns: cols, expanded: false };
            } catch { return { name, columns: [], expanded: false }; }
          })
        );
        setSchemas(loaded);
        if (loaded.length > 0) loadTableData(loaded[0].name, btoa(selectedDb));
      } catch { setSchemas([]); }
      setLoadingSchema(false);
    };
    load();
  }, [selectedDb, projectName]);

  const loadTableData = async (tableName: string, dbB64?: string) => {
    const b64 = dbB64 ?? dbBase64;
    if (!b64) return;
    setSelectedTable(tableName); setQueryMode(false);
    setQuery(`SELECT * FROM "${tableName}" LIMIT 500`);
    setLoadingData(true); setRowData([]); setColDefs([]);
    try {
      const data = await executeQuery(projectName, b64, `SELECT * FROM "${tableName}" LIMIT 500`, 500, 0);
      applyToGrid(data, setColDefs, setRowData, tableName);
    } catch (e: any) {
      setQueryError(e?.response?.data?.message || 'Failed to load table.');
    }
    setLoadingData(false);
  };

  const applyToGrid = (data: Record<string, unknown>[], setCols: any, setRows: any, tableName?: string) => {
    if (data && data.length > 0) {
      setCols(Object.keys(data[0]).map(k => ({ field: k, headerName: k, sortable: true, filter: true, resizable: true, minWidth: 80, flex: 1 })));
      setRows(data);
    } else {
      if (tableName) {
        const schema = schemas.find(s => s.name === tableName);
        if (schema?.columns.length) {
          setCols(schema.columns.map(c => ({ field: c.name, headerName: c.name, sortable: true, filter: true, resizable: true, minWidth: 80, flex: 1 })));
          setRows([]);
          return;
        }
      }
      setCols([]); setRows([]);
    }
  };

  const runQuery = async () => {
    if (!query.trim() || !dbBase64) return;
    setRunningQuery(true); setQueryError('');
    try {
      const data = await executeQuery(projectName, dbBase64, query.trim(), 1000, 0);
      applyToGrid(data, setQueryColDefs, setQueryResult);
      setQueryMode(true);
    } catch (e: any) {
      setQueryError(e?.response?.data?.message || 'Query execution failed.');
      setQueryMode(false);
    }
    setRunningQuery(false);
  };

  const handleQueryKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
  };

  // SQLite CRUD
  const handleAddRow = async (data: Record<string, any>) => {
    if (!selectedDb || !selectedTable) return;
    try {
      await sqliteInsert(projectName, btoa(selectedDb), selectedTable, data);
      setCrudMsg('Row inserted successfully');
      setShowAddRow(false);
      await loadTableData(selectedTable);
    } catch (e: any) {
      setQueryError(e?.response?.data?.message || 'Insert failed.');
    }
    setTimeout(() => setCrudMsg(''), 3000);
  };

  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!selectedDb || !selectedTable) return;
    const schema = schemas.find(s => s.name === selectedTable);
    const pkCol = schema?.columns.find(c => c.pk === 1);
    if (!pkCol || row[pkCol.name] === undefined) {
      setQueryError('Cannot delete: no primary key found.'); return;
    }
    if (!confirm(`Delete row where ${pkCol.name} = ${row[pkCol.name]}?`)) return;
    try {
      await sqliteDelete(projectName, btoa(selectedDb), selectedTable, { [pkCol.name]: row[pkCol.name] });
      setCrudMsg('Row deleted');
      await loadTableData(selectedTable);
    } catch (e: any) {
      setQueryError(e?.response?.data?.message || 'Delete failed.');
    }
    setTimeout(() => setCrudMsg(''), 3000);
  };

  const toggleSchema = (idx: number) => setSchemas(prev => prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s));
  const typeIcon = (type: string) => {
    const t = type.toLowerCase();
    return (t.includes('int') || t.includes('real') || t.includes('num') || t.includes('float'))
      ? <Hash size={11} className="col-type-icon num" />
      : <Type size={11} className="col-type-icon txt" />;
  };

  // ── Connections ─────────────────────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    try {
      const conns: DbConnection[] = await getConnections(projectName);
      setConnections(conns.filter(c => c.type === 'mongodb'));
      setExtConnections(conns.filter(c => c.type === 'mysql' || c.type === 'postgresql'));
    } catch {
      setConnections([]);
      setExtConnections([]);
    }
  }, [projectName]);

  useEffect(() => { if (dbTab === 'mongodb' || dbTab === 'external') loadConnections(); }, [dbTab, loadConnections]);

  // ── External DB (MySQL / PostgreSQL) ─────────────────────────────────────────
  const loadExtTables = async (conn: DbConnection) => {
    setSelectedExtConn(conn); setExtTables([]); setSelectedExtTable(''); setExtRowData([]); setExtColDefs([]);
    setExtQueryMode(false); setExtQuery('');
    setLoadingExt(true); setExtError('');
    try {
      const tables: string[] = await externalDbTables(projectName, conn);
      setExtTables(tables);
      if (tables.length > 0) await loadExtTableData(conn, tables[0]);
    } catch (e: any) { setExtError(e?.response?.data?.message || 'Failed to list tables.'); }
    setLoadingExt(false);
  };

  const loadExtTableData = async (conn: DbConnection, tableName: string) => {
    setSelectedExtTable(tableName); setExtQueryMode(false);
    const sql = `SELECT * FROM ${conn.type === 'mysql' ? `\`${tableName}\`` : `"${tableName}"`} LIMIT 100`;
    setExtQuery(sql);
    setLoadingExt(true); setExtRowData([]); setExtColDefs([]);
    try {
      const data = await externalDbQuery(projectName, conn, sql);
      applyToGrid(data, setExtColDefs, setExtRowData);
    } catch (e: any) { setExtError(e?.response?.data?.message || 'Failed to load table data.'); }
    setLoadingExt(false);
  };

  const runExtQuery = async () => {
    if (!extQuery.trim() || !selectedExtConn) return;
    setRunningExtQuery(true); setExtError('');
    try {
      const data = await externalDbQuery(projectName, selectedExtConn, extQuery.trim());
      applyToGrid(data, setExtQueryColDefs, setExtQueryResult);
      setExtQueryMode(true);
    } catch (e: any) {
      setExtError(e?.response?.data?.message || 'Query execution failed.');
      setExtQueryMode(false);
    }
    setRunningExtQuery(false);
  };

  const handleExtQueryKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runExtQuery(); }
  };

  const handleRemoveExtConn = async (connId: string) => {
    if (!confirm('Remove this connection?')) return;
    try { await removeConnection(projectName, connId); await loadConnections(); setSelectedExtConn(null); } catch {}
  };

  const loadMongoCollections = async (conn: DbConnection) => {
    setSelectedConn(conn); setMongoColls([]); setSelectedColl(''); setMongoDocs([]); setMongoColDefs([]);
    setLoadingMongo(true); setMongoError('');
    try {
      const colls: string[] = await mongoCollections(projectName, conn.uri!, conn.dbName!);
      setMongoColls(colls);
      if (colls.length > 0) await loadMongoDocs(conn, colls[0]);
    } catch (e: any) { setMongoError(e?.response?.data?.message || 'Failed to list collections.'); }
    setLoadingMongo(false);
  };

  const loadMongoDocs = async (conn: DbConnection, collName: string) => {
    setSelectedColl(collName); setMongoDocs([]); setMongoColDefs([]);
    setLoadingMongo(true); setMongoError('');
    try {
      const docs = await mongoFind(projectName, conn.uri!, conn.dbName!, collName, {}, 100);
      if (docs.length > 0) {
        setMongoColDefs(Object.keys(docs[0]).map(k => ({ field: k, headerName: k, sortable: true, filter: true, resizable: true, minWidth: 80, flex: 1 })));
      }
      setMongoDocs(docs);
    } catch (e: any) { setMongoError(e?.response?.data?.message || 'Failed to load documents.'); }
    setLoadingMongo(false);
  };

  const handleAddDoc = async (doc: Record<string, any>) => {
    if (!selectedConn) return;
    try {
      await mongoInsert(projectName, selectedConn.uri!, selectedConn.dbName!, selectedColl, doc);
      setCrudMsg('Document inserted');
      setShowAddDoc(false);
      await loadMongoDocs(selectedConn, selectedColl);
    } catch (e: any) { setMongoError(e?.response?.data?.message || 'Insert failed.'); }
    setTimeout(() => setCrudMsg(''), 3000);
  };

  const handleDeleteDoc = async (row: any) => {
    if (!selectedConn || !row._id) return;
    if (!confirm(`Delete document _id: ${row._id}?`)) return;
    try {
      await mongoDelete(projectName, selectedConn.uri!, selectedConn.dbName!, selectedColl, row._id);
      setCrudMsg('Document deleted');
      await loadMongoDocs(selectedConn, selectedColl);
    } catch (e: any) { setMongoError(e?.response?.data?.message || 'Delete failed.'); }
    setTimeout(() => setCrudMsg(''), 3000);
  };

  const handleRemoveConn = async (connId: string) => {
    if (!confirm('Remove this connection?')) return;
    try { await removeConnection(projectName, connId); await loadConnections(); setSelectedConn(null); } catch {}
  };

  const activeData = queryMode ? queryResult : rowData;
  const activeColDefs = queryMode ? queryColDefs : colDefs;

  return (
    <DBErrorBoundary>
    <div className="dbv-root">
      {/* DB Type Tabs */}
      <div className="dbv-type-tabs">
        <button
          id="dbv-tab-sqlite"
          className={`dbv-type-tab ${dbTab === 'sqlite' ? 'active' : ''}`}
          onClick={() => setDbTab('sqlite')}
        >
          <Database size={12} /> SQLite
        </button>
        <button
          id="dbv-tab-mongodb"
          className={`dbv-type-tab ${dbTab === 'mongodb' ? 'active' : ''}`}
          onClick={() => setDbTab('mongodb')}
        >
          <Layers size={12} /> MongoDB
        </button>
        <button
          id="dbv-tab-external"
          className={`dbv-type-tab ${dbTab === 'external' ? 'active' : ''}`}
          onClick={() => setDbTab('external')}
        >
          <Link2 size={12} /> External DB
        </button>
      </div>

      {/* ── SQLite Panel ─────────────────────────────────────────────────── */}
      {dbTab === 'sqlite' && (
        <>
          {showAddRow && selectedTable && (
            <AddRowModal
              columns={schemas.find(s => s.name === selectedTable)?.columns || []}
              onSave={handleAddRow}
              onClose={() => setShowAddRow(false)}
            />
          )}

          {loadingDbs ? (
            <div className="db-zero"><Loader size={28} className="spin" /><span>Scanning for SQLite databases…</span></div>
          ) : dbFiles.length === 0 ? (
            <div className="db-zero">
              <Database size={36} />
              <span>No SQLite databases found in this project</span>
              <small>Files with .db, .sqlite or .sqlite3 extension will appear here</small>
              <button className="button" style={{ marginTop: '0.75rem' }} onClick={refreshDbFiles}><RefreshCw size={13} /> Rescan</button>
            </div>
          ) : (
            <div className="dbv-inner">
              <div className="dbv-sidebar">
                <div className="dbv-section-hdr">
                  <Database size={13} /><span>Databases</span>
                  <button className="dbv-icon-btn" onClick={refreshDbFiles} title="Rescan"><RefreshCw size={11} /></button>
                </div>
                <div className="dbv-file-list">
                  {dbFiles.map(f => (
                    <button
                      key={f}
                      className={`dbv-file-item ${selectedDb === f ? 'active' : ''}`}
                      onClick={() => setSelectedDb(f)}
                      title={f}
                    >
                      <Database size={12} />
                      <span className="dbv-file-name">{f.split('/').pop()}</span>
                      {f.includes('/') && <span className="dbv-file-path">{f.split('/').slice(0, -1).join('/')}</span>}
                    </button>
                  ))}
                </div>

                {loadingSchema ? (
                  <div className="dbv-loading"><Loader size={14} className="spin" /><span>Loading schema…</span></div>
                ) : schemas.length > 0 && (
                  <>
                    <div className="dbv-section-hdr">
                      <Table2 size={13} /><span>Tables ({schemas.length})</span>
                    </div>
                    <div className="dbv-table-list">
                      {schemas.map((schema, idx) => (
                        <div key={schema.name}>
                          <button
                            className={`dbv-table-item ${selectedTable === schema.name && !queryMode ? 'active' : ''}`}
                            onClick={() => loadTableData(schema.name)}
                          >
                            <span role="button" tabIndex={0} className="dbv-expand-btn"
                              onClick={e => { e.stopPropagation(); toggleSchema(idx); }}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleSchema(idx); } }}
                            >
                              {schema.expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </span>
                            <Table2 size={12} />
                            <span>{schema.name}</span>
                            <span className="dbv-row-count">{schema.columns.length} col{schema.columns.length !== 1 ? 's' : ''}</span>
                          </button>
                          {schema.expanded && (
                            <div className="dbv-col-list">
                              {schema.columns.map(col => (
                                <div key={col.cid} className="dbv-col-item">
                                  {typeIcon(col.type)}
                                  <span className="dbv-col-name">{col.name}</span>
                                  <span className="dbv-col-type">{col.type || 'ANY'}</span>
                                  {col.pk === 1 && <span className="dbv-pk-badge">PK</span>}
                                  {col.notnull === 1 && <span className="dbv-nn-badge">NN</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="dbv-main">
                {crudMsg && (
                  <div className="dbv-crud-success"><Check size={13} /><span>{crudMsg}</span></div>
                )}
                {selectedDb && (
                  <div className="dbv-breadcrumb">
                    <Database size={12} />
                    <span>{selectedDb.split('/').pop()}</span>
                    {selectedTable && !queryMode && <><ChevronRight size={11} /><Table2 size={12} /><span>{selectedTable}</span></>}
                    {queryMode && <><ChevronRight size={11} /><span className="dbv-query-badge">SQL Result</span></>}
                    {(loadingData || runningQuery) && <Loader size={12} className="spin dbv-breadcrumb-spin" />}
                    {selectedTable && !queryMode && (
                      <button
                        className="dbv-add-row-btn"
                        onClick={() => setShowAddRow(true)}
                        title="Add row"
                      >
                        <Plus size={12} /> Add Row
                      </button>
                    )}
                  </div>
                )}

                {queryError && (
                  <div className="dbv-error-bar">
                    <AlertCircle size={13} /><span>{queryError}</span>
                    <button onClick={() => setQueryError('')}>×</button>
                  </div>
                )}

                <div className="dbv-grid-wrap">
                  {loadingData || runningQuery ? (
                    <div className="dbv-empty"><Loader size={20} className="spin" /> Loading…</div>
                  ) : activeColDefs.length > 0 ? (
                    <DataGrid
                      rows={activeData as Record<string, unknown>[]}
                      columns={activeColDefs as { field: string; headerName: string }[]}
                      onDelete={!queryMode ? handleDeleteRow as any : undefined}
                    />
                  ) : !selectedDb ? (
                    <div className="dbv-empty">Select a database file from the left panel</div>
                  ) : !selectedTable && !queryMode && !loadingSchema ? (
                    <div className="dbv-empty">Select a table from the left panel to preview data</div>
                  ) : queryMode ? (
                    <div className="dbv-empty">No columns or rows returned from query</div>
                  ) : null}
                </div>

                {selectedDb && (
                  <div className="dbv-query-section">
                    <div className="dbv-query-toolbar">
                      <span className="dbv-query-label">SQL Query</span>
                      <span className="dbv-query-hint-txt">Ctrl+Enter to run</span>
                      <button className="button dbv-run-btn" onClick={runQuery} disabled={runningQuery || !query.trim()} title="Run Query (Ctrl+Enter)">
                        {runningQuery ? <Loader size={13} className="spin" /> : <Play size={13} />}
                        {runningQuery ? 'Running…' : 'Run'}
                      </button>
                    </div>
                    <textarea
                      ref={queryRef}
                      className="dbv-query-editor"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleQueryKey}
                      placeholder={`SELECT * FROM "table_name" WHERE condition LIMIT 100`}
                      spellCheck={false}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MongoDB Panel ────────────────────────────────────────────────── */}
      {dbTab === 'mongodb' && (
        <>
          {showAddMongo && (
            <AddMongoModal
              projectName={projectName}
              onSave={(conn) => { setConnections(c => [...c, conn]); setShowAddMongo(false); }}
              onClose={() => setShowAddMongo(false)}
            />
          )}
          {showAddDoc && selectedConn && (
            <AddMongoDocModal onSave={handleAddDoc} onClose={() => setShowAddDoc(false)} />
          )}

          <div className="dbv-inner">
            <div className="dbv-sidebar">
              <div className="dbv-section-hdr">
                <Layers size={13} /><span>Connections</span>
                <button className="dbv-icon-btn" onClick={() => setShowAddMongo(true)} title="Add MongoDB connection"><Plus size={11} /></button>
              </div>

              {connections.length === 0 ? (
                <div className="dbv-mongo-empty">
                  <Link2 size={22} />
                  <span>No MongoDB connections</span>
                  <button className="button" style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.3rem 0.7rem' }} onClick={() => setShowAddMongo(true)}>
                    <Plus size={12} /> Add Connection
                  </button>
                </div>
              ) : (
                <div className="dbv-file-list">
                  {connections.map(conn => (
                    <div
                      key={conn.id}
                      className={`dbv-file-item ${selectedConn?.id === conn.id ? 'active' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadMongoCollections(conn)}
                    >
                      <Layers size={12} />
                      <span className="dbv-file-name">{conn.name}</span>
                      <button
                        className="dbv-icon-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={e => { e.stopPropagation(); handleRemoveConn(conn.id); }}
                        title="Remove connection"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedConn && mongoColls.length > 0 && (
                <>
                  <div className="dbv-section-hdr">
                    <Table2 size={13} /><span>Collections ({mongoColls.length})</span>
                  </div>
                  <div className="dbv-table-list">
                    {mongoColls.map(coll => (
                      <button
                        key={coll}
                        className={`dbv-table-item ${selectedColl === coll ? 'active' : ''}`}
                        onClick={() => selectedConn && loadMongoDocs(selectedConn, coll)}
                      >
                        <Table2 size={12} />
                        <span>{coll}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="dbv-main">
              {crudMsg && <div className="dbv-crud-success"><Check size={13} /><span>{crudMsg}</span></div>}

              {mongoError && (
                <div className="dbv-error-bar">
                  <AlertCircle size={13} /><span>{mongoError}</span>
                  <button onClick={() => setMongoError('')}>×</button>
                </div>
              )}

              {selectedConn && (
                <div className="dbv-breadcrumb">
                  <Layers size={12} />
                  <span>{selectedConn.name}</span>
                  <span className="dbv-file-path">({selectedConn.dbName})</span>
                  {selectedColl && <><ChevronRight size={11} /><Table2 size={12} /><span>{selectedColl}</span></>}
                  {loadingMongo && <Loader size={12} className="spin dbv-breadcrumb-spin" />}
                  {selectedColl && (
                    <button className="dbv-add-row-btn" onClick={() => setShowAddDoc(true)} title="Insert document">
                      <Plus size={12} /> Insert Doc
                    </button>
                  )}
                </div>
              )}

              <div className="dbv-grid-wrap">
                {loadingMongo ? (
                  <div className="dbv-empty"><Loader size={20} className="spin" /> Loading…</div>
                ) : mongoColDefs.length > 0 ? (
                  <DataGrid
                    rows={mongoDocs}
                    columns={mongoColDefs as { field: string; headerName: string }[]}
                    onDelete={handleDeleteDoc as any}
                  />
                ) : (
                  <div className="dbv-empty">
                    {!selectedConn ? 'Select or add a MongoDB connection from the left panel' :
                      !selectedColl ? 'Select a collection to view documents' :
                        'This collection is empty'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── External DB Panel ────────────────────────────────────────────── */}
      {dbTab === 'external' && (
        <>
          {showAddExt && (
            <AddExternalDbModal
              projectName={projectName}
              onSave={(conn) => { setExtConnections(c => [...c, conn]); setShowAddExt(false); }}
              onClose={() => setShowAddExt(false)}
            />
          )}

          <div className="dbv-inner">
            <div className="dbv-sidebar">
              <div className="dbv-section-hdr">
                <Layers size={13} /><span>Connections</span>
                <button className="dbv-icon-btn" onClick={() => setShowAddExt(true)} title="Add external connection"><Plus size={11} /></button>
              </div>

              {extConnections.length === 0 ? (
                <div className="dbv-mongo-empty">
                  <Link2 size={22} />
                  <span>No External DB connections</span>
                  <button className="button" style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.3rem 0.7rem' }} onClick={() => setShowAddExt(true)}>
                    <Plus size={12} /> Add Connection
                  </button>
                </div>
              ) : (
                <div className="dbv-file-list">
                  {extConnections.map(conn => (
                    <div
                      key={conn.id}
                      className={`dbv-file-item ${selectedExtConn?.id === conn.id ? 'active' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadExtTables(conn)}
                    >
                      <Layers size={12} />
                      <span className="dbv-file-name">{conn.name}</span>
                      <span className="dbv-file-path" style={{ textTransform: 'uppercase', fontSize: '0.65rem', marginLeft: '0.25rem' }}>({conn.type})</span>
                      <button
                        className="dbv-icon-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={e => { e.stopPropagation(); handleRemoveExtConn(conn.id); }}
                        title="Remove connection"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedExtConn && extTables.length > 0 && (
                <>
                  <div className="dbv-section-hdr">
                    <Table2 size={13} /><span>Tables ({extTables.length})</span>
                  </div>
                  <div className="dbv-table-list">
                    {extTables.map(table => (
                      <button
                        key={table}
                        className={`dbv-table-item ${selectedExtTable === table && !extQueryMode ? 'active' : ''}`}
                        onClick={() => selectedExtConn && loadExtTableData(selectedExtConn, table)}
                      >
                        <Table2 size={12} />
                        <span>{table}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="dbv-main">
              {extError && (
                <div className="dbv-error-bar">
                  <AlertCircle size={13} /><span>{extError}</span>
                  <button onClick={() => setExtError('')}>×</button>
                </div>
              )}

              {selectedExtConn && (
                <div className="dbv-breadcrumb">
                  <Layers size={12} />
                  <span>{selectedExtConn.name}</span>
                  <span className="dbv-file-path">({selectedExtConn.database})</span>
                  {selectedExtTable && !extQueryMode && <><ChevronRight size={11} /><Table2 size={12} /><span>{selectedExtTable}</span></>}
                  {extQueryMode && <><ChevronRight size={11} /><span className="dbv-query-badge">SQL Result</span></>}
                  {loadingExt && <Loader size={12} className="spin dbv-breadcrumb-spin" />}
                </div>
              )}

              <div className="dbv-grid-wrap">
                {loadingExt || runningExtQuery ? (
                  <div className="dbv-empty"><Loader size={20} className="spin" /> Loading…</div>
                ) : (extQueryMode ? extQueryResult : extRowData).length > 0 || (extQueryMode ? extQueryColDefs : extColDefs).length > 0 ? (
                  <DataGrid
                    rows={extQueryMode ? extQueryResult : extRowData}
                    columns={(extQueryMode ? extQueryColDefs : extColDefs) as { field: string; headerName: string }[]}
                  />
                ) : (
                  <div className="dbv-empty">
                    {!selectedExtConn ? 'Select or add an External DB connection from the left panel' :
                      !selectedExtTable && !extQueryMode ? 'Select a table to view data' :
                        'No columns or rows returned'}
                  </div>
                )}
              </div>

              {selectedExtConn && (
                <div className="dbv-query-section">
                  <div className="dbv-query-toolbar">
                    <span className="dbv-query-label">SQL Query</span>
                    <span className="dbv-query-hint-txt">Ctrl+Enter to run</span>
                    <button className="button dbv-run-btn" onClick={runExtQuery} disabled={runningExtQuery || !extQuery.trim()} title="Run Query (Ctrl+Enter)">
                      {runningExtQuery ? <Loader size={13} className="spin" /> : <Play size={13} />}
                      {runningExtQuery ? 'Running…' : 'Run'}
                    </button>
                  </div>
                  <textarea
                    className="dbv-query-editor"
                    value={extQuery}
                    onChange={e => setExtQuery(e.target.value)}
                    onKeyDown={handleExtQueryKey}
                    placeholder={`SELECT * FROM table_name LIMIT 100`}
                    spellCheck={false}
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </DBErrorBoundary>
  );
}
