export class CompilerError extends Error {
  constructor(message, location = {}, phase = 'Compilador') {
    super(message)
    this.name = 'CompilerError'
    this.phase = phase
    this.line = location.line ?? 1
    this.column = location.column ?? 1
  }
}
