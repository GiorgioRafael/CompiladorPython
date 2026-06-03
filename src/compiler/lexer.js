import { CompilerError } from './CompilerError'

const KEYWORDS = {
  if: 'IF',
  else: 'ELSE',
  for: 'FOR',
  in: 'IN',
  range: 'RANGE',
  while: 'WHILE',
  print: 'PRINT',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  True: 'BOOLEAN',
  False: 'BOOLEAN',
}

const SINGLE_CHAR_TOKENS = {
  '(': 'LEFT_PAREN',
  ')': 'RIGHT_PAREN',
  ':': 'COLON',
  ',': 'COMMA',
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'STAR',
  '/': 'SLASH',
  '%': 'PERCENT',
  '=': 'EQUAL',
  '<': 'LESS',
  '>': 'GREATER',
}

const TWO_CHAR_TOKENS = {
  '==': 'EQUAL_EQUAL',
  '!=': 'BANG_EQUAL',
  '<=': 'LESS_EQUAL',
  '>=': 'GREATER_EQUAL',
}

const isDigit = (char) => char >= '0' && char <= '9'
const isAlpha = (char) =>
  (char >= 'a' && char <= 'z') ||
  (char >= 'A' && char <= 'Z') ||
  char === '_'
const isAlphaNumeric = (char) => isAlpha(char) || isDigit(char)

const token = (type, lexeme, value, line, column) => ({
  type,
  lexeme,
  value,
  line,
  column,
})

const countIndent = (line) => {
  let columns = 0
  let index = 0

  while (index < line.length) {
    const char = line[index]

    if (char === ' ') {
      columns += 1
      index += 1
      continue
    }

    if (char === '\t') {
      columns += 4
      index += 1
      continue
    }

    break
  }

  return { columns, index }
}

const readNumber = (line, start, lineNumber) => {
  let current = start
  let hasDot = false

  while (current < line.length) {
    const char = line[current]

    if (isDigit(char)) {
      current += 1
      continue
    }

    if (char === '.') {
      if (hasDot) {
        throw new CompilerError(
          'Número decimal inválido.',
          { line: lineNumber, column: current + 1 },
          'Léxico',
        )
      }

      if (!isDigit(line[current + 1])) {
        throw new CompilerError(
          'Número decimal incompleto.',
          { line: lineNumber, column: current + 1 },
          'Léxico',
        )
      }

      hasDot = true
      current += 1
      continue
    }

    break
  }

  const lexeme = line.slice(start, current)

  return {
    current,
    token: token(
      'NUMBER',
      lexeme,
      {
        type: hasDot ? 'double' : 'int',
        value: Number(lexeme),
      },
      lineNumber,
      start + 1,
    ),
  }
}

const readString = (line, start, lineNumber) => {
  const quote = line[start]
  let current = start + 1
  let value = ''

  while (current < line.length) {
    const char = line[current]

    if (char === quote) {
      current += 1
      return {
        current,
        token: token(
          'STRING',
          line.slice(start, current),
          {
            type: value.length === 1 ? 'char' : 'string',
            value,
          },
          lineNumber,
          start + 1,
        ),
      }
    }

    if (char === '\\') {
      const next = line[current + 1]

      if (!next) {
        throw new CompilerError(
          'String finalizada com escape incompleto.',
          { line: lineNumber, column: current + 1 },
          'Léxico',
        )
      }

      const escaped = {
        n: '\n',
        t: '\t',
        r: '\r',
        '\\': '\\',
        '"': '"',
        "'": "'",
      }

      value += escaped[next] ?? next
      current += 2
      continue
    }

    value += char
    current += 1
  }

  throw new CompilerError(
    'String não finalizada.',
    { line: lineNumber, column: start + 1 },
    'Léxico',
  )
}

const readIdentifier = (line, start, lineNumber) => {
  let current = start

  while (current < line.length && isAlphaNumeric(line[current])) {
    current += 1
  }

  const lexeme = line.slice(start, current)
  const keywordType = KEYWORDS[lexeme]

  if (keywordType === 'BOOLEAN') {
    return {
      current,
      token: token(
        'BOOLEAN',
        lexeme,
        { type: 'boolean', value: lexeme === 'True' },
        lineNumber,
        start + 1,
      ),
    }
  }

  return {
    current,
    token: token(keywordType ?? 'IDENTIFIER', lexeme, lexeme, lineNumber, start + 1),
  }
}

const scanCode = (line, start, lineNumber, tokens) => {
  let current = start

  while (current < line.length) {
    const char = line[current]
    const column = current + 1

    if (char === ' ' || char === '\t') {
      current += 1
      continue
    }

    if (char === '#') {
      break
    }

    if (isDigit(char)) {
      const result = readNumber(line, current, lineNumber)
      tokens.push(result.token)
      current = result.current
      continue
    }

    if (char === '"' || char === "'") {
      const result = readString(line, current, lineNumber)
      tokens.push(result.token)
      current = result.current
      continue
    }

    if (isAlpha(char)) {
      const result = readIdentifier(line, current, lineNumber)
      tokens.push(result.token)
      current = result.current
      continue
    }

    const twoChar = line.slice(current, current + 2)

    if (TWO_CHAR_TOKENS[twoChar]) {
      tokens.push(token(TWO_CHAR_TOKENS[twoChar], twoChar, null, lineNumber, column))
      current += 2
      continue
    }

    if (SINGLE_CHAR_TOKENS[char]) {
      tokens.push(token(SINGLE_CHAR_TOKENS[char], char, null, lineNumber, column))
      current += 1
      continue
    }

    throw new CompilerError(
      `Caractere inesperado: "${char}".`,
      { line: lineNumber, column },
      'Léxico',
    )
  }
}

export const tokenize = (source) => {
  const tokens = []
  const indents = [0]
  const lines = source.replace(/\r\n?/g, '\n').split('\n')

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const indent = countIndent(line)
    const content = line.slice(indent.index)

    if (!content.trim() || content.trimStart().startsWith('#')) {
      return
    }

    const currentIndent = indents[indents.length - 1]

    if (indent.columns > currentIndent) {
      indents.push(indent.columns)
      tokens.push(token('INDENT', '<indent>', null, lineNumber, 1))
    } else if (indent.columns < currentIndent) {
      while (indents.length > 1 && indent.columns < indents[indents.length - 1]) {
        indents.pop()
        tokens.push(token('DEDENT', '<dedent>', null, lineNumber, 1))
      }

      if (indent.columns !== indents[indents.length - 1]) {
        throw new CompilerError(
          'Indentação inconsistente.',
          { line: lineNumber, column: 1 },
          'Léxico',
        )
      }
    }

    scanCode(line, indent.index, lineNumber, tokens)
    tokens.push(token('NEWLINE', '<newline>', null, lineNumber, line.length + 1))
  })

  const lastLine = Math.max(lines.length, 1)

  while (indents.length > 1) {
    indents.pop()
    tokens.push(token('DEDENT', '<dedent>', null, lastLine, 1))
  }

  tokens.push(token('EOF', '<eof>', null, lastLine, 1))

  return tokens
}
