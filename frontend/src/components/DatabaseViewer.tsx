import { useState, useEffect, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { getTables, getSchema, getDbFiles, executeQuery } from '../api';

ModuleRegistry.registerModules([AllCommunityModule]);
import {
  Database,
  Play,
  Table2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Hash,
  Type,
  AlertCircle,
  Loader,
} from 'lucide-react';

interface ColumnInfo { cid: number; name: string; type: string; notnull: number; pk: number; }
interface TableSchema { name: string; columns: ColumnInfo[]; expanded: boolean; }

interface DatabaseViewerProps {
  projectName: string;
}

export default function DatabaseViewer({ projectName }: DatabaseViewerProps) {
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
  const queryRef = useRef<HTMLTextAreaElement>(null);

  const dbBase64 = selectedDb ? btoa(selectedDb) : '';

  const refreshDbFiles = useCallback(async () => {
    setLoadingDbs(true);
    try {
      const files: string[] = await getDbFiles(projectName);
      setDbFiles(files);
      if (files.length > 0 && !selectedDb) {
        setSelectedDb(files[0]);
      }
    } catch {
      setDbFiles([]);
    }
    setLoadingDbs(false);
  }, [projectName, selectedDb]);

  useEffect(() => { refreshDbFiles(); }, [projectName]);

  useEffect(() => {
    if (!selectedDb) return;
    setSchemas([]);
    setSelectedTable('');
    setRowData([]);
    setColDefs([]);
    setQueryMode(false);
    setQuery('');

    const load = async () => {
      setLoadingSchema(true);
      try {
        const tables: string[] = await getTables(projectName, btoa(selectedDb));
        const loaded: TableSchema[] = await Promise.all(
          tables.map(async (name) => {
            try {
              const cols: ColumnInfo[] = await getSchema(projectName, name, btoa(selectedDb));
              return { name, columns: cols, expanded: false };
            } catch {
              return { name, columns: [], expanded: false };
            }
          })
        );
        setSchemas(loaded);
        if (loaded.length > 0) loadTableData(loaded[0].name, btoa(selectedDb));
      } catch {
        setSchemas([]);
      }
      setLoadingSchema(false);
    };
    load();
  }, [selectedDb, projectName]);

  const loadTableData = async (tableName: string, dbB64?: string) => {
    const b64 = dbB64 ?? dbBase64;
    if (!b64) return;
    setSelectedTable(tableName);
    setQueryMode(false);
    setQuery(`SELECT * FROM "${tableName}" LIMIT 500`);
    setLoadingData(true);
    setRowData([]);
    setColDefs([]);
    try {
      const data: Record<string, unknown>[] = await executeQuery(projectName, b64, `SELECT * FROM "${tableName}" LIMIT 500`, 500, 0);
      applyDataToGrid(data, setColDefs, setRowData, tableName);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setQueryError(msg || 'Failed to load table.');
    }
    setLoadingData(false);
  };

  const runQuery = async () => {
    if (!query.trim() || !dbBase64) return;
    setRunningQuery(true);
    setQueryError('');
    try {
      const data: Record<string, unknown>[] = await executeQuery(projectName, dbBase64, query.trim(), 1000, 0);
      applyDataToGrid(data, setQueryColDefs, setQueryResult);
      setQueryMode(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setQueryError(msg || 'Query execution failed.');
      setQueryMode(false);
    }
    setRunningQuery(false);
  };

  const handleQueryKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  const applyDataToGrid = (
    data: Record<string, unknown>[],
    setCols: (c: Record<string, unknown>[]) => void,
    setRows: (r: Record<string, unknown>[]) => void,
    tableName?: string,
  ) => {
    if (data && data.length > 0) {
      setCols(Object.keys(data[0]).map(k => ({
        field: k,
        headerName: k,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80,
        flex: 1,
      })));
      setRows(data);
    } else {
      if (tableName) {
        const schema = schemas.find(s => s.name === tableName);
        if (schema && schema.columns.length > 0) {
          setCols(schema.columns.map(c => ({
            field: c.name,
            headerName: c.name,
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 80,
            flex: 1,
          })));
          setRows([]);
          return;
        }
      }
      setCols([]);
      setRows([]);
    }
  };

  const toggleSchema = (idx: number) => {
    setSchemas(prev => prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s));
  };

  const typeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('int') || t.includes('real') || t.includes('num') || t.includes('float')) return <Hash size={11} className="col-type-icon num" />;
    return <Type size={11} className="col-type-icon txt" />;
  };

  if (loadingDbs) return (
    <div className="db-zero">
      <Loader size={28} className="spin" />
      <span>Scanning for SQLite databases…</span>
    </div>
  );

  if (dbFiles.length === 0) return (
    <div className="db-zero">
      <Database size={36} />
      <span>No SQLite databases found in this project</span>
      <small>Files with .db, .sqlite or .sqlite3 extension will appear here</small>
      <button className="button" style={{ marginTop: '0.75rem' }} onClick={refreshDbFiles}><RefreshCw size={13} /> Rescan</button>
    </div>
  );

  const activeData = queryMode ? queryResult : rowData;
  const activeColDefs = queryMode ? queryColDefs : colDefs;

  return (
    <div className="dbv-root">
      <div className="dbv-sidebar">
        <div className="dbv-section-hdr">
          <Database size={13} />
          <span>Databases</span>
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
              <Table2 size={13} />
              <span>Tables ({schemas.length})</span>
            </div>
            <div className="dbv-table-list">
              {schemas.map((schema, idx) => (
                <div key={schema.name}>
                  <button
                    className={`dbv-table-item ${selectedTable === schema.name && !queryMode ? 'active' : ''}`}
                    onClick={() => loadTableData(schema.name)}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="dbv-expand-btn"
                      onClick={(e) => { e.stopPropagation(); toggleSchema(idx); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSchema(idx);
                        }
                      }}
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
        {selectedDb && (
          <div className="dbv-breadcrumb">
            <Database size={12} />
            <span>{selectedDb.split('/').pop()}</span>
            {selectedTable && !queryMode && <><ChevronRight size={11} /><Table2 size={12} /><span>{selectedTable}</span></>}
            {queryMode && <><ChevronRight size={11} /><span className="dbv-query-badge">SQL Result</span></>}
            {(loadingData || runningQuery) && <Loader size={12} className="spin dbv-breadcrumb-spin" />}
          </div>
        )}

        {queryError && (
          <div className="dbv-error-bar">
            <AlertCircle size={13} />
            <span>{queryError}</span>
            <button onClick={() => setQueryError('')}>×</button>
          </div>
        )}

        <div className="dbv-grid-wrap ag-theme-alpine-dark">
          {activeColDefs && activeColDefs.length > 0 ? (
            <AgGridReact
              theme="legacy"
              rowData={activeData}
              columnDefs={activeColDefs}
              pagination={true}
              paginationPageSize={100}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              animateRows={true}
              suppressMovableColumns={false}
            />
          ) : !loadingData && !runningQuery ? (
            !selectedDb ? (
              <div className="dbv-empty">Select a database file from the left panel</div>
            ) : !selectedTable && !queryMode && !loadingSchema ? (
              <div className="dbv-empty">Select a table from the left panel to preview data</div>
            ) : queryMode ? (
              <div className="dbv-empty">No columns or rows returned from query</div>
            ) : null
          ) : null}
        </div>

        {selectedDb && (
          <div className="dbv-query-section">
            <div className="dbv-query-toolbar">
              <span className="dbv-query-label">SQL Query</span>
              <span className="dbv-query-hint-txt">Ctrl+Enter to run · SELECT only</span>
              <button
                className="button dbv-run-btn"
                onClick={runQuery}
                disabled={runningQuery || !query.trim()}
                title="Run Query (Ctrl+Enter)"
              >
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
  );
}
