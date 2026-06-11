# Compilador Python Online

Projeto acadêmico de um compilador didático de Python feito em JavaScript e React. A aplicação roda no navegador e permite escrever código, executar um subconjunto da linguagem Python e visualizar a saída em um console.

## Objetivo

O objetivo é demonstrar, de forma prática, como um compilador/interpretador pode ser organizado em etapas:

1. **Análise léxica:** transforma o texto digitado em tokens.
2. **Análise sintática:** transforma os tokens em uma árvore de sintaxe abstrata, também chamada de AST.
3. **Execução:** percorre a AST e executa o programa em um ambiente controlado.

Tecnicamente, este projeto é um interpretador didático: ele não gera código de máquina nem bytecode, mas implementa as etapas principais esperadas em um compilador simples.

## Tecnologias

- React
- Vite
- JavaScript
- CodeMirror
- Lucide React
- Vitest

## Como Rodar Localmente

Instale as dependências

```bash
npm install
```

Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Rode os testes

```bash
npm test
```

Gere a versão de produção:

```bash
npm run build
```

## Recursos Suportados

O compilador suporta os seguintes recursos básicos:

- `if` e `else`
- `for` com `range(...)`
- `while`
- `print(...)`
- variáveis com tipos inferidos: `int`, `double`, `string`, `char` e `boolean`
- operadores matemáticos: `+`, `-`, `*`, `/`, `%`
- operadores de comparação: `==`, `!=`, `<`, `<=`, `>`, `>=`
- operadores lógicos: `and`, `or`, `not`

Exemplo:

```python
nome = "Ana"
idade = 20
media = 8.5

print("Aluno:", nome)

if idade >= 18 and media >= 6:
    print("Situação: aprovado")
else:
    print("Situação: revisar")

for tentativa in range(1, 4):
    print("Tentativa", tentativa)
```

## Organização do Compilador

O núcleo do compilador fica em `src/compiler`.

- `lexer.js`: lê o código-fonte e gera tokens, incluindo tokens de indentação.
- `parser.js`: valida a estrutura do código e monta a AST.
- `interpreter.js`: executa os comandos da AST e controla variáveis, saída e limites de segurança.
- `index.js`: reúne as etapas e retorna resultado, erro, tokens, AST e memória final.
- `compiler.test.js`: cobre os principais cenários de execução e erro.

## Tratamento de Erros

Os erros são separados por fase:

- **Léxico:** caractere inesperado, string não finalizada ou indentação inconsistente.
- **Sintaxe:** comando inválido, bloco sem indentação, `:` ausente ou expressão incompleta.
- **Execução:** variável não declarada, divisão por zero, tipos incompatíveis ou possível loop infinito.

Para evitar travamentos no navegador, o interpretador usa um limite máximo de passos de execução.

## Limitações Conhecidas

Este projeto não implementa Python completo. Alguns recursos ainda não existem, como:

- funções definidas pelo usuário;
- listas, dicionários e tuplas;
- importação de bibliotecas;
- classes;
- entrada via `input`;
- escopo local de funções;
- tratamento de exceções com `try/except`.

Essas limitações foram mantidas de propósito para concentrar o projeto nos requisitos do trabalho: condicionais, loops, variáveis, operadores e saída no console.

## Uso de IA no Desenvolvimento

A IA foi usada para apoiar o planejamento da interface, a organização do compilador em etapas, a implementação do lexer/parser/interpretador e a criação dos testes automatizados. O código foi validado com `npm test`, `npm run lint` e `npm run build`.

Durante o processo, um ajuste necessário foi executar comandos de instalação separadamente no PowerShell, porque o separador `&&` não foi aceito nessa versão do terminal. A implementação final foi validada por testes automatizados e revisão visual no navegador.

## Deploy na Vercel

O projeto usa Vite, então pode ser publicado na Vercel como uma aplicação frontend comum.

Configuração esperada:

- Framework: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Depois do deploy, a Vercel fornece um link público para acessar o compilador online.
