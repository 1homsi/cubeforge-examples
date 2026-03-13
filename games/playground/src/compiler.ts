import { transform } from 'sucrase'

export interface CompileResult { code: string; error: null }
export interface CompileError  { code: null;   error: string }

// Strip `export` keyword so everything lands in the same scope
function stripExports(code: string): string {
  return code
    .replace(/^export default /gm, '')
    .replace(/^export function /gm,  'function ')
    .replace(/^export const /gm,     'const ')
    .replace(/^export class /gm,     'class ')
    .replace(/^export type /gm,      'type ')
    .replace(/^export interface /gm, 'interface ')
    .replace(/^export \{[^}]*\}[^\n]*/gm, '')
}

interface ImportGroup {
  named: Set<string>
  defaultImport: string | null
  namespace: string | null
}

// Collect all external imports from all files, deduplicate, return one merged block
// + stripped file contents (all import lines removed).
function mergeImports(files: { name: string; content: string }[]): {
  importBlock: string
  strippedContents: Map<string, string>
} {
  const groups = new Map<string, ImportGroup>()

  function getGroup(mod: string): ImportGroup {
    if (!groups.has(mod)) groups.set(mod, { named: new Set(), defaultImport: null, namespace: null })
    return groups.get(mod)!
  }

  const strippedContents = new Map<string, string>()

  for (const f of files) {
    const kept: string[] = []
    for (const line of f.content.split('\n')) {
      const m = line.match(/^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/)
      if (!m) { kept.push(line); continue }

      const [, specifiers, mod] = m

      // Local imports — drop silently
      if (mod.startsWith('./') || mod.startsWith('../')) continue

      const g = getGroup(mod)

      // Named: { X, Y as Z, ... }
      const namedMatch = specifiers.match(/\{([^}]+)\}/)
      if (namedMatch) {
        namedMatch[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => g.named.add(s))
      }

      // Default import
      const clean = specifiers.replace(/\{[^}]+\}/, '').replace(/\*\s+as\s+\w+/, '').trim().replace(/,$/, '').trim()
      if (clean && !clean.startsWith('*')) g.defaultImport = clean

      // Namespace: * as NS
      const nsMatch = specifiers.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
      if (nsMatch) g.namespace = nsMatch[1]
    }
    strippedContents.set(f.name, kept.join('\n'))
  }

  const lines: string[] = []
  for (const [mod, g] of groups) {
    const parts: string[] = []
    if (g.defaultImport) parts.push(g.defaultImport)
    if (g.namespace)     parts.push(`* as ${g.namespace}`)
    if (g.named.size > 0) parts.push(`{ ${[...g.named].join(', ')} }`)
    lines.push(parts.length ? `import ${parts.join(', ')} from '${mod}'` : `import '${mod}'`)
  }

  return { importBlock: lines.join('\n'), strippedContents }
}

// Bundle: one merged import block at top, then non-entry files, then main.tsx
export function bundle(files: { name: string; content: string }[]): string {
  const entry  = files.find(f => f.name === 'main.tsx') ?? files[files.length - 1]
  const others = files.filter(f => f !== entry)

  const { importBlock, strippedContents } = mergeImports(files)

  const parts = [importBlock]
  for (const f of others) parts.push(stripExports(strippedContents.get(f.name) ?? ''))
  parts.push(strippedContents.get(entry.name) ?? '')

  return parts.filter(s => s.trim()).join('\n\n')
}

export function compile(source: string): CompileResult | CompileError {
  try {
    const result = transform(source, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      production: true,
    })
    return { code: result.code, error: null }
  } catch (err: unknown) {
    return { code: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export function buildIframeSrcdoc(compiledCode: string): string {
  const importMap = JSON.stringify({
    imports: {
      'react':             'https://esm.sh/react@18',
      'react-dom':         'https://esm.sh/react-dom@18',
      'react-dom/client':  'https://esm.sh/react-dom@18/client',
      'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
      'cubeforge':         'https://esm.sh/cubeforge@latest',
    },
  })

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #12131f; display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
    #root { display: contents; }
  </style>
  <script type="importmap">${importMap}</script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      window.parent.postMessage({ type: 'iframe-error', message: (err && err.stack) || msg }, '*')
    }
    window.addEventListener('unhandledrejection', function(e) {
      window.parent.postMessage({ type: 'iframe-error', message: String(e.reason) }, '*')
    })
  </script>
  <script type="module">
${compiledCode}
  </script>
</body>
</html>`
}
