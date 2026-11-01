import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Props {
  titulo: string
  /** O que vai aparecer aqui e o que a pessoa pode fazer: vazio é convite para agir, não desculpa. */
  descricao: string
  /**
   * `emAndamento` mostra que o toque foi recebido, para a rede lenta não parecer tela quebrada. `desligada` é o botão que
   * não aceita outro toque enquanto o pedido que ele fez está no ar (o resumo do Analista): o texto dele diz o que acontece.
   */
  acao?: { rotulo: string; aoAcionar: () => void; emAndamento?: boolean; desligada?: boolean }
  /**
   * `tracejado` é o vazio que ocupa o lugar de um bloco inteiro da tela — a turma sem correção aprovada, onde entrariam
   * as barras de acerto por habilidade —: centralizado, com mais respiro e, se houver, um ícone em cima. O padrão é o
   * vazio de lista, alinhado à esquerda.
   */
  variante?: 'padrao' | 'tracejado'
  /** Só no `tracejado`. É enfeite: o título já diz o que falta. */
  icone?: LucideIcon
  /**
   * A onça do mockup no lugar do vazio (D80, item 3), já assinada pela função: quem passa é a tela, que importa a `Onca`. Esta peça
   * não a importa, para a entrada não carregá-la. Parada e sem balão. A `Onca` se centraliza sozinha na largura inteira, então ela só
   * combina com o `tracejado`, que centraliza também o título, o texto e a ação, como o mockup; no padrão, de texto à esquerda, a
   * onça ficaria centralizada sobre texto à esquerda. Por isso quem passa `ilustracao` passa também `variante="tracejado"`.
   */
  ilustracao?: ReactNode
}

/** O que vai em cima do título: a ilustração da tela, ou, só no tracejado, o ícone. A ilustração toma o lugar do ícone. */
function TopoDoVazio({ tracejado, icone: Icone, ilustracao }: { tracejado: boolean; icone: LucideIcon | undefined; ilustracao: ReactNode }) {
  if (ilustracao !== undefined) return <div className={`mb-3 ${tracejado ? 'flex justify-center' : ''}`}>{ilustracao}</div>
  if (tracejado && Icone !== undefined) return <Icone aria-hidden="true" size={24} strokeWidth={1.75} className="mb-3 text-sutil" />
  return null
}

/**
 * O estado vazio (`docs/interface.md` 10.2): o título em `t-secao`, o que vai aparecer ali e o que a pessoa pode fazer, e
 * uma ação. É convite para agir, e não pedido de desculpas (regra 50, item 5). A borda é de 2 px, **tracejada em
 * `borda-campo`** (3:1 contra o chão): o tracejado é o que diz "aqui falta algo", e a cor clara da `borda` o apagaria.
 * A onça só entra quando a tela a passa em `ilustracao` (9.7).
 *
 * Esta peça mora na entrada (Tech Spec da X1, seção 7c): só importa o `Button`, e nenhuma das peças que ficam fora dela.
 */
export function EmptyState({ titulo, descricao, acao, variante = 'padrao', icone: Icone, ilustracao }: Props) {
  const tracejado = variante === 'tracejado'
  return (
    <div className={`rounded-cartao border-2 border-dashed border-borda-campo bg-superficie ${tracejado ? 'flex flex-col items-center px-4 py-10 text-center' : 'p-4'}`}>
      <TopoDoVazio tracejado={tracejado} icone={Icone} ilustracao={ilustracao} />
      <p className="t-secao text-tinta">{titulo}</p>
      <p className={`t-apoio mt-1 text-apoio ${tracejado ? 'max-w-prose' : ''}`}>{descricao}</p>
      {acao && (
        // O espaço entre o botão e o "Verificando…" só existe quando há o que ler: com a região vazia ele empurrava o botão do tracejado
        // 6 px para fora do eixo do título e da ilustração.
        <div className={`mt-3 flex flex-wrap items-center ${acao.emAndamento ? 'gap-3' : ''} ${tracejado ? 'justify-center' : ''}`}>
          <Button onClick={acao.aoAcionar} disabled={acao.desligada === true}>
            {acao.rotulo}
          </Button>
          <span role="status" className="t-apoio text-apoio">
            {acao.emAndamento ? 'Verificando…' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
