import { MAXIMO_DO_NOME_DO_TITULAR, SOLICITANTES_DO_PEDIDO, TIPOS_DE_PEDIDO_DO_TITULAR, type RegistroDePedido, type PreviaDoTitularResponse, type TitularAchado } from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { buscarTitulares, previaDoTitularQueryOptions, registrarPedidoDoTitular, relerPedidosDoTitular } from './api/privacidade'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/fields/FormField'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { useDialogState } from '../../../components/ui/overlays/dialog-state'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { ErrorAlert, useSingleSubmit } from '../../../components/dialogs'
import { newRequestId } from '../../../components/request-id'
import { Select } from '../../../components/ui/fields/Select'
import { errorMessage } from '../../../api/client'
import { errorText } from '../../../components/error-text'
import { formatDate, formatNumber } from '../../../format'
import {
  anuncioDaBusca,
  AVISO_DA_ELIMINACAO,
  descricaoDoAchado,
  EFEITO_DO_PEDIDO,
  hojeEmSaoPaulo,
  ROTULO_DA_CATEGORIA_NA_PREVIA,
  ROTULO_DE_QUEM_PEDIU,
  ROTULO_DO_PAPEL,
  ROTULO_DO_TIPO,
  termoDaBusca,
  TEXTO_DA_PREVIA_SEM_DADO,
  TEXTO_DE_NINGUEM_ACHADO,
  TEXTO_DO_HOMONIMO,
  TEXTOS_DA_FALHA_DA_BUSCA,
  TEXTOS_DA_FALHA_DO_REGISTRO,
  textoDasTurmas,
  validarOPedido,
  type CampoDoPedido,
} from './textos-dos-pedidos'

/** O que o diálogo de confirmação leva da busca: a pessoa, os três campos e a chave de envio **deste** diálogo. */
interface AlvoDaConfirmacao {
  readonly titular: TitularAchado
  readonly registro: Omit<RegistroDePedido, 'chaveEnvio' | 'titularId'>
  /** Sorteada quando o diálogo abre, com conteúdo fixo: o reenvio depois de uma queda de rede leva a mesma, e não duplica (Tech Spec do F3, seção 4). */
  readonly chaveEnvio: string
}

const OPCOES_DO_TIPO = TIPOS_DE_PEDIDO_DO_TITULAR.map((valor) => ({ valor, rotulo: ROTULO_DO_TIPO[valor] }))
const OPCOES_DE_QUEM_PEDIU = SOLICITANTES_DO_PEDIDO.map((valor) => ({ valor, rotulo: ROTULO_DE_QUEM_PEDIU[valor] }))

interface PropsDoPedidoDaPessoa {
  readonly titular: TitularAchado
  readonly aoFechar: () => void
  readonly aoContinuar: (alvo: AlvoDaConfirmacao) => void
}

/**
 * O pedido da pessoa escolhida: o tipo, quem pediu e o dia em que chegou à escola, e o "Continuar". Só existe depois de a
 * pessoa ser escolhida; escolher outra monta tudo de novo (`key` pelo id dela), para o tipo e quem pediu de uma não irem
 * para a outra. A chave de envio nasce no "Continuar", com o diálogo de confirmação.
 */
function PedidoDaPessoa({ titular, aoFechar, aoContinuar }: PropsDoPedidoDaPessoa) {
  const [tipo, definirTipo] = useState('')
  const [solicitante, definirSolicitante] = useState('')
  const [chegouEm, definirChegouEm] = useState(hojeEmSaoPaulo)
  const [erros, definirErros] = useState<Readonly<Partial<Record<CampoDoPedido, string>>>>({})

  function continuar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const validacao = validarOPedido({ tipo, solicitante, chegouEm }, hojeEmSaoPaulo())
    if (!validacao.ok) {
      definirErros(validacao.erros)
      return
    }
    definirErros({})
    aoContinuar({ titular, registro: validacao.registro, chaveEnvio: newRequestId() })
  }

  return (
    <form onSubmit={continuar} noValidate className="flex min-w-0 flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="font-medium">O pedido</legend>
        <Select rotulo="Tipo do pedido" marcador="Escolha o tipo" opcoes={OPCOES_DO_TIPO} valor={tipo} aoMudar={definirTipo} obrigatoria erro={erros.tipo} />
        <Select rotulo="Quem pediu" marcador="Escolha quem pediu" opcoes={OPCOES_DE_QUEM_PEDIU} valor={solicitante} aoMudar={definirSolicitante} obrigatoria erro={erros.solicitante} />
        <FormField
          rotulo="Dia em que o pedido chegou à escola"
          dica="O prazo para responder conta deste dia."
          name="chegouEm"
          type="date"
          max={hojeEmSaoPaulo()}
          obrigatorio
          value={chegouEm}
          onChange={(evento) => definirChegouEm(evento.target.value)}
          erro={erros.chegouEm}
        />
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Continuar</Button>
        <Button variante="secundario" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

interface PropsDoDialogoDeBusca {
  readonly aoFechar: () => void
  readonly aoContinuar: (alvo: AlvoDaConfirmacao) => void
}

/**
 * A primeira etapa: achar a pessoa pelo nome e dizer o pedido. A busca sai **no Enter ou no botão**, nunca a cada letra
 * (cada busca é auditada e conta no limite de 30 por minuto), e só com 3 letras ou mais. O resultado é anunciado por
 * `aria-live`, e a pessoa se escolhe pela turma e pela matrícula, que separam dois homônimos.
 *
 * O que foi achado mora **só neste diálogo**: nada vai ao cache de consultas nem sobrevive ao fechar. O que garante o
 * "não sobrevive" é o `gcTime: 0` do `useSingleSubmit` (`components/dialogs.tsx`): quem tirar dele abre o cache de
 * mutações para os nomes achados. A resposta que chega depois de uma busca nova não a substitui (o `useMutation`
 * acompanha só a última), e a que chega com o diálogo fechado não tem onde escrever.
 */
function DialogoDeBusca({ aoFechar, aoContinuar }: PropsDoDialogoDeBusca) {
  const campoDoTermo = useRef<HTMLInputElement>(null)
  const [termo, definirTermo] = useState('')
  const [erroDoTermo, definirErroDoTermo] = useState<string | undefined>(undefined)
  const [escolhido, definirEscolhido] = useState<string | undefined>(undefined)
  const { enviar, mutacao } = useSingleSubmit({ mutationFn: buscarTitulares })

  const achados = mutacao.data?.titulares
  const titular = achados?.find((achado) => achado.id === escolhido)

  function buscar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const conferido = termoDaBusca(termo)
    if (!conferido.ok) {
      definirErroDoTermo(conferido.erro)
      return
    }
    definirErroDoTermo(undefined)
    enviar(conferido.termo)
  }

  const anuncio = mutacao.isPending ? 'Buscando…' : achados === undefined ? '' : anuncioDaBusca(achados.length)
  return (
    <Dialog titulo="Registrar pedido de titular" aoFechar={aoFechar} focoInicial={campoDoTermo}>
      <div className="mt-4 flex min-w-0 flex-col gap-4">
        <form role="search" aria-label="Buscar a pessoa" onSubmit={buscar} noValidate className="flex min-w-0 flex-col gap-3">
          <FormField
            ref={campoDoTermo}
            rotulo="Nome do aluno ou do professor"
            dica="Digite pelo menos 3 letras do nome e aperte Enter ou o botão Buscar."
            name="termo"
            type="text"
            autoComplete="off"
            maxLength={MAXIMO_DO_NOME_DO_TITULAR}
            value={termo}
            onChange={(evento) => definirTermo(evento.target.value)}
            erro={erroDoTermo}
          />
          <div>
            <Button type="submit" variante="secundario" disabled={mutacao.isPending}>
              {mutacao.isPending ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </form>
        {/* A região existe antes do texto: o leitor de tela ouve a contagem quando a busca termina (RF20). */}
        <div role="status" aria-live="polite" className="text-apoio empty:hidden">
          {anuncio}
        </div>
        {mutacao.isError && <ErrorAlert texto={errorText(mutacao.error, TEXTOS_DA_FALHA_DA_BUSCA)} />}
        {achados?.length === 0 && <p className="text-apoio">{TEXTO_DE_NINGUEM_ACHADO}</p>}
        {achados !== undefined && achados.length > 0 && (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="font-medium">Escolha a pessoa</legend>
            {achados.map((achado) => (
              <label
                key={achado.id}
                className={`flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-controle border border-borda-campo px-3 py-2 ${escolhido === achado.id ? 'bg-realce-suave' : 'bg-superficie'}`}
              >
                <input type="radio" name="titular" value={achado.id} checked={escolhido === achado.id} onChange={() => definirEscolhido(achado.id)} className="mt-0.5 size-6 shrink-0 accent-noite" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{achado.nome}</span>
                  <span className="text-sm break-words text-apoio">{descricaoDoAchado(achado)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {titular === undefined ? (
          <div>
            <Button variante="secundario" onClick={aoFechar}>
              Cancelar
            </Button>
          </div>
        ) : (
          <PedidoDaPessoa key={titular.id} titular={titular} aoFechar={aoFechar} aoContinuar={aoContinuar} />
        )}
      </div>
    </Dialog>
  )
}

/**
 * O que a escola guarda da pessoa, ao lado da confirmação (RF10). Aluno: a contagem por categoria. Professor: só o
 * cadastro e os vínculos, **sem contagem**: a resposta é a mesma para quem usou a IA e para quem não usou (D64).
 */
function Previa({ consulta }: { readonly consulta: UseQueryResult<PreviaDoTitularResponse> }) {
  if (consulta.isPending) return <p role="status" className="text-apoio">Consultando o que a escola guarda desta pessoa…</p>
  if (consulta.isError)
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro">
          {errorMessage(consulta.error)}
        </p>
        <div>
          <Button variante="secundario" onClick={() => void consulta.refetch({ cancelRefetch: false })}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  const previa = consulta.data
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="O que a escola guarda desta pessoa">
      <h3 className="font-medium">O que a escola guarda desta pessoa</h3>
      {previa.categorias.length === 0 && <p className="text-apoio">{TEXTO_DA_PREVIA_SEM_DADO}</p>}
      <ul className="flex min-w-0 flex-col gap-1 text-apoio">
        {previa.papel === 'aluno'
          ? previa.categorias.map(({ categoria, quantidade }) => (
              <li key={categoria} className="break-words">
                {ROTULO_DA_CATEGORIA_NA_PREVIA[categoria]}: {formatNumber(quantidade)}
              </li>
            ))
          : previa.categorias.map((categoria) => (
              <li key={categoria} className="break-words">
                {ROTULO_DA_CATEGORIA_NA_PREVIA[categoria]}
              </li>
            ))}
      </ul>
    </section>
  )
}

interface PropsDoDialogoDoRegistro {
  readonly alvo: AlvoDaConfirmacao
  readonly aoFechar: () => void
  /** O pedido foi registrado e a lista já foi relida. */
  readonly aoRegistrado: (nome: string, tipo: RegistroDePedido['tipo']) => void
}

/**
 * A segunda etapa, a confirmação: mostra quem, o quê, quem pediu, a chegada e a prévia antes de registrar (regra 50,
 * item 8). A eliminação é `perigo`, com os 7 dias e o que a escola guarda fora daqui; as demais, decisão `oficial`.
 *
 * **A chave de envio é a deste diálogo**: o conteúdo é fixo desde que ele abre, e por isso a queda de rede no `POST` e o
 * clique de novo mandam a mesma chave e devolvem o mesmo pedido. Só se confirma com a prévia na tela: é nela que o aviso
 * de homônimo aparece.
 */
function DialogoDoRegistro({ alvo, aoFechar, aoRegistrado }: PropsDoDialogoDoRegistro) {
  const cliente = useQueryClient()
  const { titular, registro, chaveEnvio } = alvo
  const previa = useQuery(previaDoTitularQueryOptions(titular.id))
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: async () => {
      const pedido = await registrarPedidoDoTitular({ titularId: titular.id, ...registro, chaveEnvio })
      // A lista só termina de mudar com a leitura nova: o pedido que aparece é o do servidor, e a resposta atrasada de antes é descartada.
      await relerPedidosDoTitular(cliente)
      return pedido
    },
    onSuccess: () => aoRegistrado(titular.nome, registro.tipo),
  })
  const eliminacao = registro.tipo === 'eliminacao'
  const aviso = [previa.data?.homonimo === true ? TEXTO_DO_HOMONIMO : undefined, eliminacao ? AVISO_DA_ELIMINACAO : undefined].filter((texto) => texto !== undefined).join(' ')
  return (
    <ConfirmDialog
      titulo={`Registrar pedido: ${ROTULO_DO_TIPO[registro.tipo]}`}
      familia={eliminacao ? 'perigo' : 'oficial'}
      resumo={[
        { rotulo: 'Pessoa', valor: titular.nome },
        { rotulo: 'Papel', valor: ROTULO_DO_PAPEL[titular.papel] },
        { rotulo: titular.papel === 'aluno' ? 'Turma' : 'Turmas', valor: textoDasTurmas(titular.turmas.map(({ nome }) => nome)) },
        { rotulo: 'Pedido', valor: ROTULO_DO_TIPO[registro.tipo] },
        { rotulo: 'Quem pediu', valor: ROTULO_DE_QUEM_PEDIU[registro.solicitante] },
        { rotulo: 'Chegou à escola em', valor: formatDate(registro.chegouEm) },
      ]}
      efeito={EFEITO_DO_PEDIDO[registro.tipo]}
      {...(aviso === '' ? {} : { aviso })}
      rotuloDeConfirmar={eliminacao ? 'Registrar a eliminação' : 'Registrar pedido'}
      rotuloConfirmando="Registrando…"
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={previa.data === undefined}
      {...(mutacao.isError ? { falha: errorText(mutacao.error, TEXTOS_DA_FALHA_DO_REGISTRO) } : {})}
    >
      <Previa consulta={previa} />
    </ConfirmDialog>
  )
}

/**
 * "Registrar pedido": o botão da aba e os dois diálogos que ele abre, um de cada vez (busca e confirmação). Cada abertura
 * monta o diálogo do zero, porque o anterior saiu da página ao fechar: o que foi digitado, a chave de envio e a falha de uma
 * não vão para a seguinte.
 *
 * Cancelar, em qualquer etapa, fecha tudo e esquece: sair nunca é mais difícil que entrar (D59). O foco volta ao botão
 * pelo próprio `Dialog`: a confirmação nasce quando a busca sai, e quem tinha o foco nessa hora é o botão.
 */
export function RegistrarPedido({ aoRegistrado }: { readonly aoRegistrado: (texto: string) => void }) {
  const janela = useDialogState<'busca' | 'confirmacao', AlvoDaConfirmacao>()
  const { aberta } = janela

  return (
    <>
      <Button onClick={() => janela.abrir('busca')}>Registrar pedido</Button>
      {aberta?.tipo === 'busca' && <DialogoDeBusca aoFechar={janela.fechar} aoContinuar={(alvo) => janela.abrir('confirmacao', alvo)} />}
      {/* Só a confirmação tem alvo: a abertura da busca nasce sem ele. */}
      {aberta?.alvo !== undefined && (
        <DialogoDoRegistro
          alvo={aberta.alvo}
          aoFechar={janela.fechar}
          aoRegistrado={(nome, tipo) => {
            // Fecha só a abertura em que o pedido saiu: com outra aberta, ela fica como está (`fecharSeAindaAberta`).
            janela.fecharSeAinda(aberta)
            aoRegistrado(`Pedido registrado: ${ROTULO_DO_TIPO[tipo]}, de ${nome}.`)
          }}
        />
      )}
    </>
  )
}
