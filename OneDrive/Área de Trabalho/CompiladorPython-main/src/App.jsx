import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import {
  AlertTriangle,
  BookOpen,
  Braces,
  CheckCircle2,
  Code2,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
} from 'lucide-react'
import { runCompiler } from './compiler'
import './App.css'

const DEFAULT_CODE = `nome = "Ana"
idade = 20
media = 8.5

print("Aluno:", nome)

if idade >= 18 and media >= 6:
    print("Situação: aprovado")
else:
    print("Situação: revisar")

for tentativa in range(1, 4):
    print("Tentativa", tentativa)

contador = 0
while contador < 2:
    print("while", contador)
    contador = contador + 1`

    //bir
const EMPTY_RESULT = {
  success: true,
  phase: 'Pronto',
  output: [],
  error: null,
  tokens: [],
  ast: null,
  environment: {},
  steps: 0,
}

const editorExtensions = [python()]

const supportedFeatures = [
  'IF',
  'ELSE',
  'FOR',
  'WHILE',
  'PRINT',
  'VARIÁVEIS',
  'OPERADORES LÓGICOS',
  'OPERADORES MATEMÁTICOS',
]

const formatVariable = ([name, data]) => `${name}: ${data.type} = ${data.value}`

function App() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [result, setResult] = useState(() => runCompiler(DEFAULT_CODE))

  const variables = useMemo(
    () => Object.entries(result.environment ?? {}),
    [result.environment],
  )

  const runCode = () => {
    setResult(runCompiler(code))
  }

  const clearOutput = () => {
    setResult(EMPTY_RESULT)
  }

  const loadExample = () => {
    setCode(DEFAULT_CODE)
    setResult(runCompiler(DEFAULT_CODE))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Code2 size={22} strokeWidth={2.2} />
          </span>
          <div>
            <h1>Compilador Python</h1>
            <p>Interpretador didático feito em JavaScript</p>
          </div>
        </div>

        <div className="toolbar" aria-label="Ações do compilador">
          <button className="button primary" type="button" onClick={runCode}>
            <Play size={18} aria-hidden="true" />
            Executar
          </button>
          <button className="button" type="button" onClick={clearOutput}>
            <Trash2 size={18} aria-hidden="true" />
            Limpar saída
          </button>
          <button className="button" type="button" onClick={loadExample}>
            <RotateCcw size={18} aria-hidden="true" />
            Exemplo
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Área de compilação">
        <section className="tool-panel editor-panel" aria-labelledby="editor-title">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                <Braces size={16} aria-hidden="true" />
                Código
              </span>
              <h2 id="editor-title">Editor</h2>
            </div>
            <span className="panel-meta">Python subset</span>
          </div>

          <div className="editor-frame">
            <CodeMirror
              value={code}
              height="100%"
              theme="dark"
              extensions={editorExtensions}
              basicSetup={{
                foldGutter: false,
                highlightActiveLine: true,
                autocompletion: false,
              }}
              onChange={setCode}
              aria-label="Editor de código Python"
            />
          </div>
        </section>

        <aside className="tool-panel output-panel" aria-labelledby="output-title">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                <Terminal size={16} aria-hidden="true" />
                Saída
              </span>
              <h2 id="output-title">Console</h2>
            </div>

            <span className={`status-pill ${result.success ? 'success' : 'error'}`}>
              {result.success ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <AlertTriangle size={16} aria-hidden="true" />
              )}
              {result.success ? result.phase : result.error.phase}
            </span>
          </div>

          <div className="console">
            {result.output.length > 0 ? (
              result.output.map((line, index) => (
                <div className="console-line" key={`${line}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <code>{line || ' '}</code>
                </div>
              ))
            ) : (
              <p className="empty-console">Sem saída no console.</p>
            )}

            {result.error ? (
              <div className="error-box">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>{result.error.phase}</strong>
                  <span>
                    Linha {result.error.line}, coluna {result.error.column}
                  </span>
                  <code>{result.error.message}</code>
                </div>
              </div>
            ) : null}
          </div>

          <div className="runtime-grid">
            <div>
              <span>Tokens</span>
              <strong>{result.tokens.length}</strong>
            </div>
            <div>
              <span>Passos</span>
              <strong>{result.steps}</strong>
            </div>
            <div>
              <span>Variáveis</span>
              <strong>{variables.length}</strong>
            </div>
          </div>

          <div className="memory-panel" aria-label="Memória de variáveis">
            <div className="memory-title">
              <BookOpen size={16} aria-hidden="true" />
              Memória
            </div>
            {variables.length > 0 ? (
              variables.map((variable) => (
                <code className="memory-row" key={variable[0]}>
                  {formatVariable(variable)}
                </code>
              ))
            ) : (
              <span className="memory-empty">Nenhuma variável registrada.</span>
            )}
          </div>
        </aside>
      </section>

      <section className="feature-strip" aria-label="Recursos suportados">
        {supportedFeatures.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </section>
    </main>
  )
}

export default App
