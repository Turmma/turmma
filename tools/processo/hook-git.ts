// O git hook nativo (RF14, techspec.md §5a): o mesmo julgamento do `PreToolUse`, mas dentro do git, e por isso vale para o
// `/usr/bin/git`, o `env`, o `command`, o `sh -c`, o script, outro checkout e outro worktree. O que o `PreToolUse` lê no texto
// do comando, aqui o git entrega pronto: a mensagem no arquivo, o índice como ele vai ser commitado e as refs do push.
//
//   node tools/processo/hook-git.ts commit-msg <arquivo>   ← `tools/processo/git-hooks/commit-msg`
//   node tools/processo/hook-git.ts pre-push               ← `tools/processo/git-hooks/pre-push`, com as refs na entrada padrão
//
// Os dois scripts só chamam este arquivo com `CLAUDE_CODE_AGENT` no ambiente, e quem nasce de um papel do time é quem passa
// por aqui: o commit do Joaquim e o do Orquestrador não têm a variável (`techspec.md` §12). Sai 0 quando o git pode seguir e 1
// quando recusa, com o motivo em stderr. **Erro de carga recusa:** qualquer exceção, daqui ou de um módulo que não carregou,
// é recusa, e script que não acha este arquivo também (o `exec node` falha). O que a máquina não alcança está em
// "Limites declarados", na Tech Spec, e a terceira camada (`ci:conferir-entregas`) é quem pega.
//
// Não há caminho `(mvp: …)` (D77): saiu na 14.0 (RF18), e a fatia que ele servia já pousou. Commit com o marcador é código sem tarefa.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { arquivosPreparados, BRANCHES_PROTEGIDAS, conteudoDoHead, ehPapelDoTime, LIMITE_DE_LEITURA_DO_GIT, PAPEIS_DO_TIME } from './comando-git.ts'
import type { ConteudoDe } from './guardioes-por-caminho.ts'
import { avaliarMutacoes } from './mutacoes.ts'
import { bloqueioDoForaDoProcesso, decidirCommit } from './portao.ts'

const git = (raiz: string, argumentos: string[]): string =>
  execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: LIMITE_DE_LEITURA_DO_GIT })

/** A sessão é de papel: a variável existe e não está vazia. Quem não a tem (Joaquim, Orquestrador) não é julgado aqui. */
const ehSessaoDePapel = (papel: string | undefined): papel is string => papel !== undefined && papel !== ''

/** O motivo de o papel não valer, ou `null` quando é de terminal do time (`.claude/agents/`). */
function recusaDoPapel(papel: string, acao: 'Commit' | 'Push'): string | null {
  if (ehPapelDoTime(papel)) return null
  return `${acao} bloqueado: \`CLAUDE_CODE_AGENT\` é \`${papel}\`, e papel do time é um destes: ${PAPEIS_DO_TIME.join(', ')}. Valor que não é de papel não pula o julgamento.`
}

/**
 * O conteúdo de um arquivo como está no índice, ou no HEAD quando pedido; `null` quando ele não está lá. Vale o índice, e não o
 * disco: é o que vai para o commit.
 */
export function conteudoDoIndice(raiz: string): ConteudoDe {
  const doHead = conteudoDoHead(raiz)
  return (arquivo, onde) => {
    if (onde === 'head') return doHead(arquivo)
    try {
      return git(raiz, ['show', `:${arquivo}`])
    } catch {
      return null
    }
  }
}

/** O veredito do `commit-msg`: o motivo da recusa, ou `null` quando o commit passa. */
export function bloqueioDoCommitMsg(raiz: string, arquivoDaMensagem: string, papel: string): string | null {
  const recusa = recusaDoPapel(papel, 'Commit')
  if (recusa !== null) return recusa
  const mensagem = readFileSync(arquivoDaMensagem, 'utf8')
  const fora = bloqueioDoForaDoProcesso('', mensagem)
  if (fora !== null) return fora
  return decidirCommit({ mensagem, arquivos: arquivosPreparados(raiz), conteudoDe: conteudoDoIndice(raiz), raiz, papel }, avaliarMutacoes)
}

/**
 * O veredito do `pre-push`: as refs vêm da entrada padrão, uma por linha, `<ref local> <oid local> <ref remota> <oid remota>`.
 * Vale a ref **remota**, que é o destino: `HEAD:develop` e a remoção de `develop` (`:develop`) chegam as duas como
 * `refs/heads/develop`, e `--all` e `--mirror` listam cada branch.
 */
export function bloqueioDoPrePush(refs: string, papel: string): string | null {
  const recusa = recusaDoPapel(papel, 'Push')
  if (recusa !== null) return recusa
  const destinos = refs.split('\n').map((linha) => linha.trim().split(/\s+/)[2])
  const protegidas = BRANCHES_PROTEGIDAS.filter((branch) => destinos.includes(`refs/heads/${branch}`))
  if (protegidas.length === 0) return null
  return (
    `Push bloqueado: este push alcança ${protegidas.map((branch) => `\`${branch}\``).join(', ')}, e as branches ${BRANCHES_PROTEGIDAS.join(', ')} só recebem por ` +
    `pouso, com a palavra do Joaquim (D78). Quem faz isso é o Orquestrador, não o papel \`${papel}\`. O seu push é o da branch do andar: ` +
    '`git push -u origin HEAD`, dentro do checkout do andar.'
  )
}

/** Roda o git hook pedido. Devolve o motivo da recusa, ou `null` quando o git pode seguir. */
export function rodar(argumentos: string[], ambiente: NodeJS.ProcessEnv, lerEntradaPadrao: () => string): string | null {
  const papel = ambiente['CLAUDE_CODE_AGENT']
  if (!ehSessaoDePapel(papel)) return null
  const [modo, arquivoDaMensagem] = argumentos
  if (modo === 'commit-msg' && arquivoDaMensagem) return bloqueioDoCommitMsg(git(process.cwd(), ['rev-parse', '--show-toplevel']).trim(), arquivoDaMensagem, papel)
  if (modo === 'pre-push') return bloqueioDoPrePush(lerEntradaPadrao(), papel)
  return `Git hook bloqueado: uso desconhecido (${argumentos.join(' ')}).`
}

// Só roda ao ser chamado como programa: o teste importa as funções acima sem disparar o hook. O nome do arquivo, e não o caminho
// real dele: o node entrega o `argv[1]` sem resolver link simbólico e o `import.meta.url` resolvido, e um checkout sob um link
// nunca casaria os dois, o que deixaria o hook passar tudo em silêncio.
if (basename(process.argv[1] ?? '') === 'hook-git.ts') {
  let motivo: string | null
  try {
    motivo = rodar(process.argv.slice(2), process.env, () => readFileSync(0, 'utf8'))
  } catch (erro) {
    motivo = `Git hook bloqueado: ele falhou ao carregar ou ao julgar (${(erro as Error).message}). Avise o Joaquim.`
  }
  if (motivo !== null) {
    process.stderr.write(`${motivo}\n`)
    process.exit(1)
  }
}
