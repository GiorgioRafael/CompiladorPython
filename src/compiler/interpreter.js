import { CompilerError } from './CompilerError'

const NUMBER_TYPES = new Set(['int', 'double'])
const TEXT_TYPES = new Set(['string', 'char'])
const INTEGER_INPUT_PATTERN = /^[+-]?\d+$/
const DOUBLE_INPUT_PATTERN = /^[+-]?(?:\d+\.\d+|\d+\.|\.\d+)$/
const BOOLEAN_INPUTS = new Map([
  ['True', true],
  ['False', false],
  ['true', true],
  ['false', false],
])

const isPromiseLike = (value) =>
  Boolean(value) && typeof value.then === 'function'

export const interpret = (program, options = {}) => {
  const runtime = new Runtime(options)
  return runtime.run(program)
}

export const interpretAsync = async (program, options = {}) => {
  const runtime = new Runtime(options)
  return runtime.runAsync(program)
}

class Runtime {
  constructor({
    maxSteps = 10000,
    inputProvider = null,
    inputValues = null,
    onOutput = null,
  } = {}) {
    this.environment = new Map()
    this.output = []
    this.steps = 0
    this.maxSteps = maxSteps
    this.inputProvider = inputProvider
    this.inputQueue = Array.isArray(inputValues) ? [...inputValues] : null
    this.onOutput = onOutput
  }

  run(program) {
    try {
      this.executeBlock(program.body)

      return this.executionResult()
    } catch (error) {
      this.attachExecutionState(error)
      throw error
    }
  }

  async runAsync(program) {
    try {
      await this.executeBlockAsync(program.body)

      return this.executionResult()
    } catch (error) {
      this.attachExecutionState(error)
      throw error
    }
  }

  executeBlock(statements) {
    statements.forEach((statement) => this.executeStatement(statement))
  }

  async executeBlockAsync(statements) {
    for (const statement of statements) {
      await this.executeStatementAsync(statement)
    }
  }

  executeStatement(statement) {
    this.guard(statement.loc)

    switch (statement.type) {
      case 'Assignment': {
        this.environment.set(statement.name, this.evaluate(statement.value))
        return
      }

      case 'Print': {
        const values = statement.args.map((expression) =>
          this.formatValue(this.evaluate(expression)),
        )
        this.emitOutput(values.join(' '))
        return
      }

      case 'If': {
        if (this.isTruthy(this.evaluate(statement.condition))) {
          this.executeBlock(statement.thenBranch)
        } else {
          this.executeBlock(statement.elseBranch)
        }
        return
      }

      case 'While': {
        while (this.isTruthy(this.evaluate(statement.condition))) {
          this.guard(statement.loc)
          this.executeBlock(statement.body)
        }
        return
      }

      case 'For': {
        this.executeFor(statement)
        return
      }

      default:
        this.runtimeError(`Comando não implementado: ${statement.type}.`, statement.loc)
    }
  }

  async executeStatementAsync(statement) {
    this.guard(statement.loc)

    switch (statement.type) {
      case 'Assignment': {
        this.environment.set(
          statement.name,
          await this.evaluateAsync(statement.value),
        )
        return
      }

      case 'Print': {
        const values = []

        for (const expression of statement.args) {
          values.push(this.formatValue(await this.evaluateAsync(expression)))
        }

        this.emitOutput(values.join(' '))
        return
      }

      case 'If': {
        if (this.isTruthy(await this.evaluateAsync(statement.condition))) {
          await this.executeBlockAsync(statement.thenBranch)
        } else {
          await this.executeBlockAsync(statement.elseBranch)
        }
        return
      }

      case 'While': {
        while (this.isTruthy(await this.evaluateAsync(statement.condition))) {
          this.guard(statement.loc)
          await this.executeBlockAsync(statement.body)
        }
        return
      }

      case 'For': {
        await this.executeForAsync(statement)
        return
      }

      default:
        this.runtimeError(`Comando não implementado: ${statement.type}.`, statement.loc)
    }
  }

  executeFor(statement) {
    const args = statement.rangeArgs.map((expression) =>
      this.expectInteger(this.evaluate(expression), expression.loc),
    )

    this.runFor(statement, args, (body) => this.executeBlock(body))
  }

  async executeForAsync(statement) {
    const args = []

    for (const expression of statement.rangeArgs) {
      args.push(
        this.expectInteger(await this.evaluateAsync(expression), expression.loc),
      )
    }

    await this.runForAsync(statement, args)
  }

  runFor(statement, args, executeBody) {
    const start = args.length === 1 ? 0 : args[0]
    const end = args.length === 1 ? args[0] : args[1]
    const step = args.length === 3 ? args[2] : 1

    if (step === 0) {
      this.runtimeError('O terceiro argumento do range não pode ser zero.', statement.loc)
    }

    for (
      let value = start;
      step > 0 ? value < end : value > end;
      value += step
    ) {
      this.guard(statement.loc)
      this.environment.set(statement.iterator, { type: 'int', value })
      executeBody(statement.body)
    }
  }

  async runForAsync(statement, args) {
    const start = args.length === 1 ? 0 : args[0]
    const end = args.length === 1 ? args[0] : args[1]
    const step = args.length === 3 ? args[2] : 1

    if (step === 0) {
      this.runtimeError('O terceiro argumento do range não pode ser zero.', statement.loc)
    }

    for (
      let value = start;
      step > 0 ? value < end : value > end;
      value += step
    ) {
      this.guard(statement.loc)
      this.environment.set(statement.iterator, { type: 'int', value })
      await this.executeBlockAsync(statement.body)
    }
  }

  evaluate(expression) {
    switch (expression.type) {
      case 'Literal':
        return { type: expression.valueType, value: expression.value }

      case 'Identifier':
        return this.resolveVariable(expression)

      case 'UnaryExpression':
        return this.evaluateUnary(expression)

      case 'BinaryExpression':
        return this.evaluateBinary(expression)

      case 'CallExpression':
        return this.evaluateCall(expression)

      default:
        this.runtimeError(`Expressão não implementada: ${expression.type}.`, expression.loc)
    }
  }

  async evaluateAsync(expression) {
    switch (expression.type) {
      case 'Literal':
        return { type: expression.valueType, value: expression.value }

      case 'Identifier':
        return this.resolveVariable(expression)

      case 'UnaryExpression':
        return this.evaluateUnaryAsync(expression)

      case 'BinaryExpression':
        return this.evaluateBinaryAsync(expression)

      case 'CallExpression':
        return this.evaluateCallAsync(expression)

      default:
        this.runtimeError(`Expressão não implementada: ${expression.type}.`, expression.loc)
    }
  }

  evaluateUnary(expression) {
    const value = this.evaluate(expression.argument)

    return this.applyUnaryOperator(expression, value)
  }

  async evaluateUnaryAsync(expression) {
    const value = await this.evaluateAsync(expression.argument)

    return this.applyUnaryOperator(expression, value)
  }

  applyUnaryOperator(expression, value) {
    if (expression.operator === 'NOT') {
      return { type: 'boolean', value: !this.isTruthy(value) }
    }

    if (expression.operator === 'MINUS') {
      this.expectNumber(value, expression.loc)
      return { type: value.type, value: -value.value }
    }

    this.runtimeError('Operador unário inválido.', expression.loc)
  }

  evaluateBinary(expression) {
    if (expression.operator === 'AND') {
      const left = this.evaluate(expression.left)
      return {
        type: 'boolean',
        value: this.isTruthy(left) && this.isTruthy(this.evaluate(expression.right)),
      }
    }

    if (expression.operator === 'OR') {
      const left = this.evaluate(expression.left)
      return {
        type: 'boolean',
        value: this.isTruthy(left) || this.isTruthy(this.evaluate(expression.right)),
      }
    }

    const left = this.evaluate(expression.left)
    const right = this.evaluate(expression.right)

    return this.applyBinaryOperator(expression, left, right)
  }

  async evaluateBinaryAsync(expression) {
    if (expression.operator === 'AND') {
      const left = await this.evaluateAsync(expression.left)
      return {
        type: 'boolean',
        value:
          this.isTruthy(left) &&
          this.isTruthy(await this.evaluateAsync(expression.right)),
      }
    }

    if (expression.operator === 'OR') {
      const left = await this.evaluateAsync(expression.left)
      return {
        type: 'boolean',
        value:
          this.isTruthy(left) ||
          this.isTruthy(await this.evaluateAsync(expression.right)),
      }
    }

    const left = await this.evaluateAsync(expression.left)
    const right = await this.evaluateAsync(expression.right)

    return this.applyBinaryOperator(expression, left, right)
  }

  applyBinaryOperator(expression, left, right) {
    switch (expression.operator) {
      case 'PLUS':
        return this.addValues(left, right, expression.loc)

      case 'MINUS':
        return this.numericOperation(left, right, expression.loc, (a, b) => a - b)

      case 'STAR':
        return this.numericOperation(left, right, expression.loc, (a, b) => a * b)

      case 'SLASH':
        if (right.value === 0) {
          this.runtimeError('Divisão por zero.', expression.loc)
        }
        this.expectNumber(left, expression.loc)
        this.expectNumber(right, expression.loc)
        return { type: 'double', value: left.value / right.value }

      case 'PERCENT':
        if (right.value === 0) {
          this.runtimeError('Resto da divisão por zero.', expression.loc)
        }
        return this.numericOperation(left, right, expression.loc, (a, b) => a % b)

      case 'EQUAL_EQUAL':
        return { type: 'boolean', value: this.areEqual(left, right) }

      case 'BANG_EQUAL':
        return { type: 'boolean', value: !this.areEqual(left, right) }

      case 'LESS':
        return this.compareValues(left, right, expression.loc, (a, b) => a < b)

      case 'LESS_EQUAL':
        return this.compareValues(left, right, expression.loc, (a, b) => a <= b)

      case 'GREATER':
        return this.compareValues(left, right, expression.loc, (a, b) => a > b)

      case 'GREATER_EQUAL':
        return this.compareValues(left, right, expression.loc, (a, b) => a >= b)

      default:
        this.runtimeError('Operador binário inválido.', expression.loc)
    }
  }

  evaluateCall(expression) {
    if (expression.callee !== 'input') {
      this.runtimeError(`Função "${expression.callee}" não implementada.`, expression.loc)
    }

    const prompt = this.evaluateInputPrompt(expression)
    const value = this.readInput(prompt, expression.loc)

    this.echoInput(prompt, value)
    return this.valueFromInput(value)
  }

  async evaluateCallAsync(expression) {
    if (expression.callee !== 'input') {
      this.runtimeError(`Função "${expression.callee}" não implementada.`, expression.loc)
    }

    const prompt = await this.evaluateInputPromptAsync(expression)
    const value = await this.readInputAsync(prompt, expression.loc)

    this.echoInput(prompt, value)
    return this.valueFromInput(value)
  }

  evaluateInputPrompt(expression) {
    if (expression.args.length > 1) {
      this.runtimeError('input aceita no máximo um argumento de prompt.', expression.loc)
    }

    if (expression.args.length === 0) {
      return ''
    }

    return this.formatValue(this.evaluate(expression.args[0]))
  }

  async evaluateInputPromptAsync(expression) {
    if (expression.args.length > 1) {
      this.runtimeError('input aceita no máximo um argumento de prompt.', expression.loc)
    }

    if (expression.args.length === 0) {
      return ''
    }

    return this.formatValue(await this.evaluateAsync(expression.args[0]))
  }

  readInput(prompt, location) {
    if (!this.inputProvider) {
      return this.readQueuedInput(location)
    }

    const value = this.inputProvider(prompt, this.inputContext(location))

    if (isPromiseLike(value)) {
      this.runtimeError(
        'Este input precisa de execução assíncrona. Use runCompilerAsync para ler dados do terminal.',
        location,
      )
    }

    return value
  }

  async readInputAsync(prompt, location) {
    if (!this.inputProvider) {
      return this.readQueuedInput(location)
    }

    return this.inputProvider(prompt, this.inputContext(location))
  }

  readQueuedInput(location) {
    if (this.inputQueue?.length > 0) {
      return this.inputQueue.shift()
    }

    this.runtimeError(
      'O programa chamou input(...), mas nenhuma entrada foi fornecida pelo terminal.',
      location,
    )
  }

  inputContext(location) {
    return {
      line: location?.line,
      column: location?.column,
      output: [...this.output],
      environment: this.snapshotEnvironment(),
    }
  }

  echoInput(prompt, value) {
    const inputText = String(value ?? '')
    const promptText = String(prompt ?? '')

    this.emitOutput(promptText ? `${promptText}${inputText}` : `> ${inputText}`)
  }

  valueFromInput(value) {
    const text = String(value ?? '')
    const trimmed = text.trim()

    if (BOOLEAN_INPUTS.has(trimmed)) {
      return { type: 'boolean', value: BOOLEAN_INPUTS.get(trimmed) }
    }

    if (INTEGER_INPUT_PATTERN.test(trimmed)) {
      return { type: 'int', value: Number(trimmed) }
    }

    if (DOUBLE_INPUT_PATTERN.test(trimmed)) {
      return { type: 'double', value: Number(trimmed) }
    }

    return { type: text.length === 1 ? 'char' : 'string', value: text }
  }

  addValues(left, right, location) {
    if (this.isNumber(left) && this.isNumber(right)) {
      return {
        type: left.type === 'double' || right.type === 'double' ? 'double' : 'int',
        value: left.value + right.value,
      }
    }

    if (this.isText(left) && this.isText(right)) {
      const value = left.value + right.value
      return { type: value.length === 1 ? 'char' : 'string', value }
    }

    this.runtimeError('Use + apenas entre números ou entre textos.', location)
  }

  numericOperation(left, right, location, operation) {
    this.expectNumber(left, location)
    this.expectNumber(right, location)

    const value = operation(left.value, right.value)

    return {
      type: left.type === 'double' || right.type === 'double' ? 'double' : 'int',
      value,
    }
  }

  compareValues(left, right, location, compare) {
    if (this.isNumber(left) && this.isNumber(right)) {
      return { type: 'boolean', value: compare(left.value, right.value) }
    }

    if (this.isText(left) && this.isText(right)) {
      return { type: 'boolean', value: compare(left.value, right.value) }
    }

    this.runtimeError('Comparação requer valores compatíveis.', location)
  }

  areEqual(left, right) {
    if (this.isNumber(left) && this.isNumber(right)) {
      return left.value === right.value
    }

    return left.value === right.value && left.type === right.type
  }

  resolveVariable(expression) {
    if (!this.environment.has(expression.name)) {
      this.runtimeError(`Variável "${expression.name}" não declarada.`, expression.loc)
    }

    return this.environment.get(expression.name)
  }

  expectNumber(value, location) {
    if (!this.isNumber(value)) {
      this.runtimeError('Esta operação requer números.', location)
    }
  }

  expectInteger(value, location) {
    if (value.type !== 'int') {
      this.runtimeError('range aceita apenas valores inteiros.', location)
    }

    return value.value
  }

  isNumber(value) {
    return NUMBER_TYPES.has(value.type)
  }

  isText(value) {
    return TEXT_TYPES.has(value.type)
  }

  isTruthy(value) {
    if (value.type === 'boolean') {
      return value.value
    }

    if (this.isNumber(value)) {
      return value.value !== 0
    }

    if (this.isText(value)) {
      return value.value.length > 0
    }

    return Boolean(value.value)
  }

  formatValue(value) {
    if (value.type === 'boolean') {
      return value.value ? 'True' : 'False'
    }

    return String(value.value)
  }

  emitOutput(line) {
    const outputLine = String(line)

    this.output.push(outputLine)
    this.onOutput?.(outputLine, [...this.output])
  }

  guard(location) {
    this.steps += 1

    if (this.steps > this.maxSteps) {
      this.runtimeError(
        'Limite de execução atingido. Verifique se existe um loop infinito.',
        location,
      )
    }
  }

  executionResult() {
    return {
      output: [...this.output],
      environment: this.snapshotEnvironment(),
      steps: this.steps,
    }
  }

  attachExecutionState(error) {
    if (!error || typeof error !== 'object') {
      return
    }

    error.output = [...this.output]
    error.environment = this.snapshotEnvironment()
    error.steps = this.steps
  }

  snapshotEnvironment() {
    return Object.fromEntries(
      [...this.environment.entries()].map(([name, value]) => [
        name,
        { type: value.type, value: value.value },
      ]),
    )
  }

  runtimeError(message, location) {
    throw new CompilerError(message, location, 'Execução')
  }
}
