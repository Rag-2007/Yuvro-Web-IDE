import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { readFile, writeFile } from '../api';

export interface CodeEditorRef {
  save: () => Promise<void>;
}

interface Props {
  projectName: string;
  filePath: string | null;
  onUnsavedChange?: (unsaved: boolean) => void;
}

const CodeEditor = forwardRef<CodeEditorRef, Props>(({ projectName, filePath, onUnsavedChange }, ref) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (filePath) {
      const fetchFile = async () => {
        setLoading(true);
        try {
          const res = await readFile(projectName, filePath);
          setContent(res.content);
          onUnsavedChange?.(false);
        } catch {
          setContent('');
        }
        setLoading(false);
      };
      fetchFile();
    }
  }, [filePath, projectName]);

  const saveFile = async () => {
    if (!filePath || !editorRef.current) return;
    setSaving(true);
    try {
      const currentContent = editorRef.current.getValue();
      await writeFile(projectName, filePath, currentContent);
      onUnsavedChange?.(false);
    } catch {
      alert('Failed to save file.');
    }
    setSaving(false);
  };

  useImperativeHandle(ref, () => ({ save: saveFile }));

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      await saveFile();
    });
  };

  const getLanguage = (path: string) => {
    const decoded = atob(path);
    if (decoded.endsWith('.py')) return 'python';
    if (decoded.endsWith('.js') || decoded.endsWith('.mjs')) return 'javascript';
    if (decoded.endsWith('.ts') || decoded.endsWith('.tsx')) return 'typescript';
    if (decoded.endsWith('.jsx')) return 'javascript';
    if (decoded.endsWith('.html')) return 'html';
    if (decoded.endsWith('.css')) return 'css';
    if (decoded.endsWith('.json')) return 'json';
    if (decoded.endsWith('.md')) return 'markdown';
    if (decoded.endsWith('.yaml') || decoded.endsWith('.yml')) return 'yaml';
    if (decoded.endsWith('.sh')) return 'shell';
    if (decoded.endsWith('.sql')) return 'sql';
    if (decoded.endsWith('.xml')) return 'xml';
    if (decoded.endsWith('.env') || decoded.endsWith('.toml') || decoded.endsWith('.ini') || decoded.endsWith('.cfg')) return 'ini';
    return 'plaintext';
  };

  if (!filePath) {
    return (
      <div className="editor-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <p>Select a file to start editing</p>
        <span>Click any file in the explorer on the left</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="editor-placeholder">
        <div className="spinner" />
        <p>Loading file...</p>
      </div>
    );
  }

  return (
    <>
      {saving && <div className="save-indicator">Saving...</div>}
      <Editor
        height="100%"
        language={getLanguage(filePath)}
        theme="vs-dark"
        value={content}
        onChange={(value) => {
          setContent(value || '');
          onUnsavedChange?.(true);
        }}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
          fontLigatures: true,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          roundedSelection: true,
          automaticLayout: true,
        }}
      />
    </>
  );
});

CodeEditor.displayName = 'CodeEditor';
export default CodeEditor;
