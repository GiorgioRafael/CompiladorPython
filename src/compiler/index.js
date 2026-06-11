import { CompilerError } from './CompilerError'
import { interpret, interpretAsync } from './interpreter'
import { tokenize } from './lexer'
import { parse } from './parser'

const visibleTokens = (tokens) =>
  tokens.filter((token) => !['NEWLINE', 'INDENT', 'DEDENT', 'EOF'].includes(token.type))

export const compile = (source) => {
  const tokens = tokenize(source)
  const ast = parse(tokens)

  return { tokens, ast }
}

const successResult = (tokens, ast, execution) => ({
  success: true,
  phase: 'Executado',
  output: execution.output,
  error: null,
  tokens: visibleTokens(tokens),
  ast,
  environment: execution.environment,
  steps: execution.steps,
})

const errorResult = (error, tokens, ast) => {
  const compilerError =
    error instanceof CompilerError
      ? error
      : new CompilerError('Erro inesperado durante a execução.', {}, 'Erro')

  return {
    success: false,
    phase: compilerError.phase,
    output: error?.output ?? [],
    error: {
      message: compilerError.message,
      line: compilerError.line,
      column: compilerError.column,
      phase: compilerError.phase,
    },
    tokens: visibleTokens(tokens),
    ast,
    environment: error?.environment ?? {},
    steps: error?.steps ?? 0,
  }
}

export const runCompiler = (source, options = {}) => {
  let tokens = []
  let ast = null

  try {
    tokens = tokenize(source)
    ast = parse(tokens)

    const execution = interpret(ast, options)

    return successResult(tokens, ast, execution)
  } catch (error) {
    return errorResult(error, tokens, ast)
  }
}

export const runCompilerAsync = async (source, options = {}) => {
  let tokens = []
  let ast = null

  try {
    tokens = tokenize(source)
    ast = parse(tokens)

    const execution = await interpretAsync(ast, options)

    return successResult(tokens, ast, execution)
  } catch (error) {
    return errorResult(error, tokens, ast)
  }
}

export { tokenize, parse, interpret, interpretAsync }
