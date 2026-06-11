import { CompilerError } from './CompilerError'

export const parse = (tokens) => {
  const parser = new Parser(tokens)
  return parser.parseProgram()
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.current = 0
  }

  parseProgram() {
    const body = []

    while (!this.atEnd()) {
      if (this.match('NEWLINE')) {
        continue
      }

      if (this.check('DEDENT')) {
        this.raise(this.peek(), 'Indentação encerrada sem bloco correspondente.')
      }

      body.push(this.parseStatement())
    }

    return { type: 'Program', body }
  }

  parseStatement() {
    if (this.match('PRINT')) {
      return this.parsePrint(this.previous())
    }

    if (this.match('IF')) {
      return this.parseIf(this.previous())
    }

    if (this.match('WHILE')) {
      return this.parseWhile(this.previous())
    }

    if (this.match('FOR')) {
      return this.parseFor(this.previous())
    }

    if (this.check('IDENTIFIER') && this.checkNext('EQUAL')) {
      return this.parseAssignment()
    }

    this.raise(
      this.peek(),
      'Comando inválido. Use atribuição, print, if, else, for ou while.',
    )
  }

  parseAssignment() {
    const name = this.consume('IDENTIFIER', 'Nome de variável esperado.')
    this.consume('EQUAL', 'Use "=" para atribuir valor à variável.')
    const value = this.parseExpression()
    this.consumeStatementEnd()

    return {
      type: 'Assignment',
      name: name.lexeme,
      value,
      loc: name,
    }
  }

  parsePrint(loc) {
    this.consume('LEFT_PAREN', 'Use "(" depois de print.')
    const args = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(this.parseExpression())
      } while (this.match('COMMA'))
    }

    this.consume('RIGHT_PAREN', 'Use ")" para finalizar o print.')
    this.consumeStatementEnd()

    return { type: 'Print', args, loc }
  }

  parseIf(loc) {
    const condition = this.parseExpression()
    this.consume('COLON', 'Use ":" depois da condição do if.')
    const thenBranch = this.parseBlock()
    let elseBranch = []

    if (this.match('ELSE')) {
      this.consume('COLON', 'Use ":" depois do else.')
      elseBranch = this.parseBlock()
    }

    return { type: 'If', condition, thenBranch, elseBranch, loc }
  }

  parseWhile(loc) {
    const condition = this.parseExpression()
    this.consume('COLON', 'Use ":" depois da condição do while.')
    const body = this.parseBlock()

    return { type: 'While', condition, body, loc }
  }

  parseFor(loc) {
    const iterator = this.consume('IDENTIFIER', 'Nome da variável do for esperado.')
    this.consume('IN', 'Use "in" no laço for.')
    this.consume('RANGE', 'Este compilador suporta for apenas com range(...).')
    this.consume('LEFT_PAREN', 'Use "(" depois de range.')

    const args = []

    if (!this.check('RIGHT_PAREN')) {
      do {
        args.push(this.parseExpression())
      } while (this.match('COMMA'))
    }

    if (args.length < 1 || args.length > 3) {
      this.raise(
        this.peek(),
        'range precisa receber 1, 2 ou 3 argumentos.',
      )
    }

    this.consume('RIGHT_PAREN', 'Use ")" para finalizar o range.')
    this.consume('COLON', 'Use ":" depois do for.')
    const body = this.parseBlock()

    return {
      type: 'For',
      iterator: iterator.lexeme,
      rangeArgs: args,
      body,
      loc,
    }
  }

  parseBlock() {
    this.consume('NEWLINE', 'Depois de ":" comece o bloco em uma nova linha.')
    this.consume('INDENT', 'O bloco precisa estar indentado.')

    const body = []

    while (!this.check('DEDENT') && !this.atEnd()) {
      if (this.match('NEWLINE')) {
        continue
      }

      body.push(this.parseStatement())
    }

    if (body.length === 0) {
      this.raise(this.peek(), 'Blocos vazios não são suportados.')
    }

    this.consume('DEDENT', 'Fim de bloco esperado.')

    return body
  }

  parseExpression() {
    return this.parseOr()
  }

  parseOr() {
    let expression = this.parseAnd()

    while (this.match('OR')) {
      const operator = this.previous()
      const right = this.parseAnd()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseAnd() {
    let expression = this.parseEquality()

    while (this.match('AND')) {
      const operator = this.previous()
      const right = this.parseEquality()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseEquality() {
    let expression = this.parseComparison()

    while (this.match('EQUAL_EQUAL', 'BANG_EQUAL')) {
      const operator = this.previous()
      const right = this.parseComparison()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseComparison() {
    let expression = this.parseTerm()

    while (this.match('LESS', 'LESS_EQUAL', 'GREATER', 'GREATER_EQUAL')) {
      const operator = this.previous()
      const right = this.parseTerm()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseTerm() {
    let expression = this.parseFactor()

    while (this.match('PLUS', 'MINUS')) {
      const operator = this.previous()
      const right = this.parseFactor()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseFactor() {
    let expression = this.parseUnary()

    while (this.match('STAR', 'SLASH', 'PERCENT')) {
      const operator = this.previous()
      const right = this.parseUnary()
      expression = this.binaryExpression(expression, operator, right)
    }

    return expression
  }

  parseUnary() {
    if (this.match('NOT', 'MINUS')) {
      const operator = this.previous()
      const right = this.parseUnary()

      return {
        type: 'UnaryExpression',
        operator: operator.type,
        argument: right,
        loc: operator,
      }
    }

    return this.parseCall()
  }

  parseCall() {
    let expression = this.parsePrimary()

    while (this.match('LEFT_PAREN')) {
      const paren = this.previous()
      const args = []

      if (!this.check('RIGHT_PAREN')) {
        do {
          args.push(this.parseExpression())
        } while (this.match('COMMA'))
      }

      this.consume('RIGHT_PAREN', 'Use ")" para finalizar a chamada da função.')

      if (expression.type !== 'Identifier') {
        this.raise(paren, 'Somente funções nomeadas podem ser chamadas.')
      }

      expression = {
        type: 'CallExpression',
        callee: expression.name,
        args,
        loc: expression.loc,
      }
    }

    return expression
  }

  parsePrimary() {
    if (this.match('NUMBER', 'STRING', 'BOOLEAN')) {
      const literal = this.previous()

      return {
        type: 'Literal',
        value: literal.value.value,
        valueType: literal.value.type,
        loc: literal,
      }
    }

    if (this.match('IDENTIFIER')) {
      const identifier = this.previous()

      return {
        type: 'Identifier',
        name: identifier.lexeme,
        loc: identifier,
      }
    }

    if (this.match('LEFT_PAREN')) {
      const expression = this.parseExpression()
      this.consume('RIGHT_PAREN', 'Use ")" para finalizar a expressão.')
      return expression
    }

    this.raise(this.peek(), 'Expressão esperada.')
  }

  binaryExpression(left, operator, right) {
    return {
      type: 'BinaryExpression',
      operator: operator.type,
      left,
      right,
      loc: operator,
    }
  }

  consumeStatementEnd() {
    if (this.match('NEWLINE')) {
      return
    }

    if (this.check('EOF') || this.check('DEDENT')) {
      return
    }

    this.raise(this.peek(), 'Fim da linha esperado.')
  }

  consume(type, message) {
    if (this.check(type)) {
      return this.advance()
    }

    this.raise(this.peek(), message)
  }

  match(...types) {
    if (!types.some((type) => this.check(type))) {
      return false
    }

    this.advance()
    return true
  }

  check(type) {
    if (this.atEnd()) {
      return type === 'EOF'
    }

    return this.peek().type === type
  }

  checkNext(type) {
    if (this.current + 1 >= this.tokens.length) {
      return false
    }

    return this.tokens[this.current + 1].type === type
  }

  advance() {
    if (!this.atEnd()) {
      this.current += 1
    }

    return this.previous()
  }

  atEnd() {
    return this.peek().type === 'EOF'
  }

  peek() {
    return this.tokens[this.current]
  }

  previous() {
    return this.tokens[this.current - 1]
  }

  raise(token, message) {
    throw new CompilerError(message, token, 'Sintaxe')
  }
}
