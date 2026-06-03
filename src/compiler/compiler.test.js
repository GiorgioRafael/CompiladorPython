import { describe, expect, it } from 'vitest'
import { runCompiler } from './index'

describe('compilador didático de Python', () => {
  it('executa print com texto', () => {
    const result = runCompiler('print("Olá")')

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['Olá'])
  })

  it('executa variáveis numéricas e texto', () => {
    const result = runCompiler(`
nome = "Ana"
idade = 20
print(nome, idade)
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['Ana 20'])
    expect(result.environment.nome).toEqual({ type: 'string', value: 'Ana' })
    expect(result.environment.idade).toEqual({ type: 'int', value: 20 })
  })

  it('respeita precedência dos operadores matemáticos', () => {
    const result = runCompiler(`
x = 4 + 3 * 2
y = x / 2
print(y)
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['5'])
    expect(result.environment.y).toEqual({ type: 'double', value: 5 })
  })

  it('executa if e else', () => {
    const result = runCompiler(`
nota = 8
if nota >= 6:
    print("aprovado")
else:
    print("revisar")
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['aprovado'])
  })

  it('executa while', () => {
    const result = runCompiler(`
i = 0
while i < 3:
    print(i)
    i = i + 1
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['0', '1', '2'])
  })

  it('executa for com range', () => {
    const result = runCompiler(`
for i in range(1, 4):
    print(i)
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['1', '2', '3'])
  })

  it('executa operadores lógicos', () => {
    const result = runCompiler(`
idade = 19
tem_documento = True
if idade >= 18 and tem_documento:
    print("entrada liberada")
else:
    print("entrada negada")
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['entrada liberada'])
  })

  it('compara int e double pelo valor numérico', () => {
    const result = runCompiler(`
inteiro = 5
decimal = 5.0
print(inteiro == decimal)
`)

    expect(result.success).toBe(true)
    expect(result.output).toEqual(['True'])
  })

  it('reporta erro de sintaxe', () => {
    const result = runCompiler(`
if True
    print("erro")
`)

    expect(result.success).toBe(false)
    expect(result.error.phase).toBe('Sintaxe')
  })

  it('reporta variável inexistente', () => {
    const result = runCompiler('print(nome)')

    expect(result.success).toBe(false)
    expect(result.error.phase).toBe('Execução')
    expect(result.error.message).toContain('não declarada')
  })

  it('bloqueia loop infinito', () => {
    const result = runCompiler(
      `
i = 0
while i < 1:
    print(i)
`,
      { maxSteps: 8 },
    )

    expect(result.success).toBe(false)
    expect(result.error.message).toContain('loop infinito')
  })
})
