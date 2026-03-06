import { useState, useEffect, useRef, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { preInit, compile, buildIframeSrcdoc } from './compiler'
import { TEMPLATES } from './templates'

const DEBOUNCE_MS = 600

type Status = { kind: 'ok' } | { kind: 'building' } | { kind: 'loading' } | { kind: 'error'; message: string }

export function App() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [code, setCode] = useState(TEMPLATES[0].code)
  const [srcdoc, setSrcdoc] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)

  // Pre-initialize esbuild-wasm immediately on mount
  useEffect(() => {
    setStatus({ kind: 'loading' })
    preInit().then(() => {
      readyRef.current = true
      // Trigger first build once WASM is ready
      run(TEMPLATES[0].code)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = useCallback(async (source: string) => {
    setStatus({ kind: 'building' })
    const result = await compile(source)
    if (result.error !== null) {
      setStatus({ kind: 'error', message: result.error })
    } else {
      setSrcdoc(buildIframeSrcdoc(result.code))
      setStatus({ kind: 'ok' })
    }
  }, [])

  // Debounce rebuilds on code change (skip until WASM is ready)
  useEffect(() => {
    if (!readyRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => run(code), DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [code, run])

  function handleTemplateChange(id: string) {
    const tpl = TEMPLATES.find(t => t.id === id)
    if (!tpl) return
    setTemplateId(id)
    setCode(tpl.code)
  }

  // Suppress Monaco's "cannot find module" errors — we have no type defs loaded.
  // Syntax errors still show. Actual compile errors come from esbuild in the status bar.
  function handleEditorMount(_: unknown, monaco: Monaco) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    })
  }

  const statusLabel =
    status.kind === 'loading' ? '◌ loading engine…'
    : status.kind === 'building' ? '◌ building…'
    : status.kind === 'ok' ? '● ready'
    : '✕ error'

  return (
    <div className="playground">
      <div className="toolbar">
        <span className="toolbar-logo">cubeforge playground</span>
        <div className="toolbar-sep" />
        <select
          className="template-select"
          value={templateId}
          onChange={e => handleTemplateChange(e.target.value)}
        >
          {TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span className={`status ${status.kind}`}>{statusLabel}</span>
      </div>

      <div className="panels">
        <div className="editor-panel">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            value={code}
            onChange={v => setCode(v ?? '')}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 12 },
            }}
          />
        </div>

        <div className="preview-panel">
          {srcdoc && (
            <iframe
              key={srcdoc}
              srcDoc={srcdoc}
              sandbox="allow-scripts"
              title="game preview"
            />
          )}
          {status.kind === 'error' && (
            <div className="error-overlay">
              <div className="error-box">{status.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
