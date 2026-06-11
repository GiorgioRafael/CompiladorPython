import { CompilerError } from './CompilerError'

export const interpret = (ast, options = {}) => {
  const interpreter = new Interpreter(options)
  return interpreter.run(ast)
}

class Interpreter {
  constructor(options = {}) {
    this.environment = {}
    this.output = []
    this.steps = 0
    this.maxSteps = options.maxSteps ?? 1000
    this.loopGuard = 0
  }

  run(ast) {
    try {
      this.executeProgram(ast)
      return {
        output: this.output,
        environment: this.environment,
        steps: this.steps,
      }
    } catch (error) {
      if (error instanceof CompilerError) {
        error.steps = this.steps
        error.environment = this.environment
        error.output = this.output
      }
      throw error
    }
  }

  executeProgram(node) {
    for (const stmt of node.body) {
      this.executeStatement(stmt)
      this.checkSteps()
    }
  }

  executeStatement(stmt) {
    this.steps++

    switch (stmt.type) {
      case 'Assignment':
        this.executeAssignment(stmt)
        break
      case 'Print':
        this.executePrint(stmt)
        break
      case 'If':
        this.executeIf(stmt)
        break
      case 'While':
        this.executeWhile(stmt)
        break
      case 'For':
        this.executeFor(stmt)
        break
      default:
        this.raise(stmt.loc, `Comando desconhecido: ${stmt.type}`)
    }
  }

  executeAssignment(node) {
    const value = this.evaluateExpression(node.value)
    this.environment[node.name] = this.toTypedValue(value)
  }

  executePrint(node) {
    const values = node.args.map(arg => this.evaluateExpression(arg))
    const outputLine = values.map(v => this.stringify(v)).join(' ')
    this.output.push(outputLine)
  }

  executeIf(node) {
    const condition = this.isTruthy(this.evaluateExpression(node.condition))
    const branch = condition ? node.thenBranch : node.elseBranch
    for (const stmt of branch) {
      this.executeStatement(stmt)
    }
  }

  executeWhile(node) {
    while (this.isTruthy(this.evaluateExpression(node.condition))) {
      for (const stmt of node.body) {
        this.executeStatement(stmt)
      }
      this.checkSteps()
    }
  }

  executeFor(node) {
    const [start, end, step] = this.evaluateRangeArgs(node.rangeArgs)
    for (let i = start; i < end; i += step) {
      this.environment[node.iterator] = this.toTypedValue(i)
      for (const stmt of node.body) {
        this.executeStatement(stmt)
      }
      this.checkSteps()
    }
    delete this.environment[node.iterator]
  }

  evaluateRangeArgs(args) {
    if (args.length === 1) {
      const end = this.evaluateExpression(args[0])
      return [0, end, 1]
    } else if (args.length === 2) {
      const start = this.evaluateExpression(args[0])
      const end = this.evaluateExpression(args[1])
      return [start, end, 1]
    } else if (args.length === 3) {
      const start = this.evaluateExpression(args[0])
      const end = this.evaluateExpression(args[1])
      const step = this.evaluateExpression(args[2])
      if (step === 0) this.raise(args[2].loc, 'Step não pode ser zero.')
      return [start, end, step]
    }
    this.raise(args[0]?.loc, 'range requer 1, 2 ou 3 argumentos.')
  }

  evaluateExpression(expr) {
    this.steps++

    switch (expr.type) {
      case 'Literal':
        return expr.value
      case 'Identifier':
        return this.getVariable(expr.name, expr.loc)
      case 'BinaryExpression':
        return this.evaluateBinary(expr)
      case 'UnaryExpression':
        return this.evaluateUnary(expr)
      default:
        this.raise(expr.loc, `Expressão desconhecida: ${expr.type}`)
    }
  }

  evaluateBinary(node) {
    const left = this.evaluateExpression(node.left)
    const right = this.evaluateExpression(node.right)

    switch (node.operator) {
      // Aritméticos
      case 'PLUS':
        if (typeof left === 'string' || typeof right === 'string')
          return this.stringify(left) + this.stringify(right)
        return left + right
      case 'MINUS':
        return left - right
      case 'STAR':
        return left * right
      case 'SLASH':
        if (right === 0) this.raise(node.loc, 'Divisão por zero.')
        return left / right
      case 'PERCENT':
        return left % right
      // Relacionais
      case 'EQUAL_EQUAL':
        return this.isEqual(left, right)
      case 'BANG_EQUAL':
        return !this.isEqual(left, right)
      case 'LESS':
        return left < right
      case 'LESS_EQUAL':
        return left <= right
      case 'GREATER':
        return left > right
      case 'GREATER_EQUAL':
        return left >= right
      case 'AND':
        return this.isTruthy(left) ? right : left
      case 'OR':
        return this.isTruthy(left) ? left : right
      default:
        this.raise(node.loc, `Operador binário desconhecido: ${node.operator}`)
    }
  }

  evaluateUnary(node) {
    const arg = this.evaluateExpression(node.argument)

    switch (node.operator) {
      case 'NOT':
        return !this.isTruthy(arg)
      case 'MINUS':
        return -arg
      default:
        this.raise(node.loc, `Operador unário desconhecido: ${node.operator}`)
    }
  }

  getVariable(name, loc) {
    if (!(name in this.environment)) {
      this.raise(loc, `Variável '${name}' não declarada.`)
    }
    return this.environment[name].value
  }

  toTypedValue(value) {
    if (typeof value === 'boolean')
      return { type: 'boolean', value }
    if (typeof value === 'number')
      return { type: Number.isInteger(value) ? 'int' : 'double', value }
    if (typeof value === 'string')
      return { type: value.length === 1 ? 'char' : 'string', value }
    return { type: 'unknown', value }
  }

  stringify(value) {
    if (typeof value === 'boolean') return value ? 'True' : 'False'
    return String(value)
  }

  isTruthy(value) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') return value.length > 0
    return true
  }

  isEqual(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b
    return a === b
  }

  checkSteps() {
    if (this.steps > this.maxSteps) {
      throw new CompilerError(
        `Número máximo de passos (${this.maxSteps}) excedido. Possível loop infinito.`,
        {},
        'Execução'
      )
    }
  }

  raise(token, message) {
    throw new CompilerError(message, token, 'Execução')
  }
}