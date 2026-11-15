// Entrada dos hooks de revisão (.claude/settings.json). A lógica está em documento-de-revisao.ts (`registrar`) e em
// portao.ts (`portao`), com caducidade.ts e comando-git.ts; o revisoes.ts só os reexporta, e o teste fica em revisoes.test.ts.
//   node tools/processo/hook-revisoes.ts registrar   ← SubagentStop
//   node tools/processo/hook-revisoes.ts portao      ← PreToolUse do Bash
//   node tools/processo/hook-revisoes.ts escrita     ← PreToolUse do Write: não reescreve documento que já tem a seção "Revisões"
// O `portao` recusa por JSON no stdout e sai 0 (o comando dele em settings.json só cobre o hook que não carrega); a `escrita` recusa
// com a saída 2 e a frase no stderr, e o comando dela devolve a 2 sem somar a mensagem de "não carregou". Não uniformize os dois.
import { readFileSync } from 'node:fs'
import { avaliarMutacoes } from './mutacoes.ts'
import { decidirEscrita, portao, registrar } from './revisoes.ts'

function lerEntrada(): Parameters<typeof registrar>[0] {
  try {
    return JSON.parse(readFileSync(0, 'utf8')) as Parameters<typeof registrar>[0]
  } catch {
    return {}
  }
}

const modo = process.argv[2]
const entrada = lerEntrada()
const raiz = process.env['CLAUDE_PROJECT_DIR'] ?? entrada.cwd ?? process.cwd()

if (modo === 'registrar') {
  // Falha ao registrar nunca derruba o revisor: sem registro, o portão bloqueia o commit.
  try {
    registrar(entrada, raiz)
  } catch (erro) {
    process.stderr.write(`revisoes: não foi possível registrar (${(erro as Error).message})\n`)
  }
} else if (modo === 'portao') {
  let motivo: string | null
  try {
    // Com a conferência das mutações: o commit de tarefa só passa se o último portão conferiu os blocos como estão agora.
    motivo = portao(entrada, raiz, undefined, avaliarMutacoes)
  } catch (erro) {
    motivo = `Comando bloqueado: o portão de revisões falhou (${(erro as Error).message}). Avise o Joaquim.`
  }
  if (motivo) {
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }),
    )
  }
} else if (modo === 'escrita') {
  // Saída 2 é a recusa do Claude Code, e a mensagem de stderr chega a quem escreveu. Falha ao decidir também recusa:
  // o conserto do hook se faz com Edit, que este gancho não vê.
  let motivo: string | null
  try {
    motivo = decidirEscrita(entrada, raiz)
  } catch (erro) {
    motivo = `Write bloqueado: o hook de escrita falhou (${(erro as Error).message}). Use Edit e avise o Joaquim.`
  }
  if (motivo) {
    process.stderr.write(`${motivo}\n`)
    process.exit(2)
  }
}
