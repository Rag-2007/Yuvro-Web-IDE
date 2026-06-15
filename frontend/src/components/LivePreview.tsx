import { useRef, useState, useEffect } from 'react';
import { Monitor, RefreshCw, ExternalLink, AlertCircle, Loader } from 'lucide-react';

interface LivePreviewProps {
  runCommand: string;
  isRunning: boolean;
}

function extractPort(cmd: string): number {
  // Try --port XXXX or --port=XXXX
  const portFlag = cmd.match(/--port[=\s]+(\d+)/);
  if (portFlag) return parseInt(portFlag[1]);
  // Try :XXXX pattern (e.g. --host 0.0.0.0 --port 8000)
  const colonPort = cmd.match(/:(\d{4,5})\b/);
  if (colonPort) return parseInt(colonPort[1]);
  // Defaults by framework keyword
  if (cmd.includes('runserver')) return 8000;
  if (cmd.includes('uvicorn')) return 8000;
  if (cmd.includes('flask') || cmd.includes('app.py')) return 5000;
  if (cmd.includes('npm run dev') || cmd.includes('vite')) return 5173;
  if (cmd.includes('npm start')) return 3000;
  if (cmd.includes('node')) return 3000;
  return 8000;
}

export default function LivePreview({ runCommand, isRunning }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [port, setPort] = useState<number>(8000);
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Auto-detect port from run command
  useEffect(() => {
    if (runCommand) {
      const detected = extractPort(runCommand);
      setPort(detected);
    }
  }, [runCommand]);

  // Auto-refresh iframe when server starts
  useEffect(() => {
    if (isRunning) {
      setLoading(true);
      // Give the server a moment to boot before loading
      const t = setTimeout(() => setIframeKey(k => k + 1), 2000);
      return () => clearTimeout(t);
    }
  }, [isRunning]);

  const previewUrl = `http://localhost:${port}`;

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey(k => k + 1);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleIframeLoad = () => setLoading(false);

  return (
    <div className="preview-root">
      <div className="preview-toolbar">
        <Monitor size={13} className="preview-icon" />
        <span className="preview-label">Live Preview</span>

        {/* Auto-detected port badge — read-only, no URL bar */}
        <span className="preview-port-badge">
          :{port}
        </span>

        <div style={{ flex: 1 }} />

        <button
          id="preview-refresh-btn"
          className="preview-action-btn"
          onClick={handleRefresh}
          title="Refresh preview"
          disabled={!isRunning}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="preview-action-btn"
          title={`Open ${previewUrl} in new tab`}
          style={{ pointerEvents: isRunning ? 'auto' : 'none', opacity: isRunning ? 1 : 0.4 }}
        >
          <ExternalLink size={13} />
        </a>
      </div>

      <div className="preview-body">
        {!isRunning ? (
          <div className="preview-empty">
            <Monitor size={40} />
            <span>Start your server to see the live preview</span>
            <small>Hit <strong>Run</strong> in the toolbar — the app will appear here on port <strong>{port}</strong></small>
          </div>
        ) : (
          <>
            {loading && (
              <div className="preview-loading">
                <Loader size={22} className="spin" />
                <span>Connecting to localhost:{port}…</span>
              </div>
            )}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={previewUrl}
              className="preview-iframe"
              title="Live Preview"
              onLoad={handleIframeLoad}
              onError={() => setLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              style={{ opacity: loading ? 0 : 1 }}
            />
            <div className="preview-csp-note">
              <AlertCircle size={11} />
              <span>If the frame is blank, the server may block iframe embedding. Use <strong>Open in new tab</strong> ↗</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
