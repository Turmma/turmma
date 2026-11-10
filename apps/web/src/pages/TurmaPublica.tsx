import {
  ErrorCode,
  codigoDaTurmaValido,
  MENSAGENS_DA_SALA,
  mensagemDaSala,
  normalizarCodigoDaTurma,
  PARAMETRO_DA_CONTA_PROVADA,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
  TAMANHO_MAXIMO_MATRICULA,
  TAMANHO_MAXIMO_SENHA,
  TAMANHO_MINIMO_SENHA_NOVA,
  VALOR_DA_CONTA_PROVADA,
  type ReivindicarSalaRequest,
  type SalaAbertaResponse,
} from '@educa/shared'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { ApiError } from '../api/client'
import { abrirSala, reivindicarNome } from '../api/salas'
import { caminhoDaEscola } from '../paths'
import { Button } from '../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES, SECONDARY_LINK_CLASSES } from '../components/ui/button-variants'
import { FormField } from '../components/ui/fields/FormField'
import { PasswordInput } from '../components/ui/fields/PasswordInput'
import { CascaPublica } from '../components/CascaPublica'
import { LoadingState } from '../components/states'
import { usePageTitle } from '../document-title'
import { apagarCaminhoDaSala, lerCaminhoDaSala, type Caminho } from './caminho-da-sala'
import { ContaDaEscolaNaSala } from './ContaDaEscolaNaSala'
import { clearFragment, readFragmentToken } from './url-fragment'
import { enviarComReenvio } from './retry-with-backoff'

type NomeLivre = SalaAbertaResponse['nomes'][number]

type Etapa =
  /** O campo do código: sem link, com o link que não vale, ou com o código que não achou turma. */
  | { readonly nome: 'codigo'; readonly aviso?: string; readonly abrindo: boolean }
  /** O link abrindo a turma. */
  | { readonly nome: 'abrindo' }
  /** O link que não abriu por rede, servidor ou limite, ou a volta do provedor que não abriu a sala: "Tentar de novo" usa o caminho que ficou na memória. */
  | { readonly nome: 'falhou'; readonly caminho: Caminho; readonly erro: unknown; readonly conta: boolean }
  /** `conta`: o aluno provou a conta da escola (a volta do provedor) e o pedido do nome sai sem senha. */
  | { readonly nome: 'aberta'; readonly caminho: Caminho; readonly turma: string; readonly nomes: readonly NomeLivre[]; readonly conta: boolean }
  | { readonly nome: 'enviado'; readonly caminho: Caminho; readonly conta: boolean }

const codigoDoErro = (erro: unknown): ErrorCode => (erro instanceof ApiError ? erro.codigo : ErrorCode.ERRO_INTERNO)
const esperaDoErro = (erro: unknown): number | undefined => (erro instanceof ApiError ? erro.esperaSegundos : undefined)

/** O caminho como o contrato o leva: o token **ou** o código, nunca os dois. */
const noPedido = (caminho: Caminho): { token: string } | { codigo: string } => (caminho.tipo === 'link' ? { token: caminho.token } : { codigo: caminho.codigo })

/** Como a página começa: a tela, o foco no campo do código e a abertura que o efeito dispara (a do link, ou a da volta do provedor, com `conta`). */
interface Comeco {
  readonly etapa: Etapa
  readonly foco: number
  readonly abrir: { readonly caminho: Caminho; readonly conta: boolean } | undefined
}

/**
 * Lê o endereço e o `sessionStorage`, sem apagar nada (a leitura da primeira renderização é pura; o efeito apaga). O link no fragmento vence: é outra sala, e a prova da conta
 * não vale para ela. Com `?conta=provada` (que a API põe ao devolver o aluno com a conta provada), o caminho guardado antes de sair abre a sala; sem ele (vencido, de outro slug, aba
 * nova), o aluno recomeça pelo link ou pelo código, com o aviso e o foco no campo, e a API nem é chamada.
 */
function comecar(slug: string): Comeco {
  const token = readFragmentToken()
  if (token !== undefined) return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho: { tipo: 'link', token }, conta: false } }
  const voltou = new URL(window.location.href).searchParams.get(PARAMETRO_DA_CONTA_PROVADA) === VALOR_DA_CONTA_PROVADA
  if (!voltou) return { etapa: { nome: 'codigo', abrindo: false }, foco: 0, abrir: undefined }
  const caminho = lerCaminhoDaSala(slug)
  if (caminho === undefined) return { etapa: { nome: 'codigo', aviso: CONTA_PERDIDA, abrindo: false }, foco: 1, abrir: undefined }
  return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho, conta: true } }
}

/** Tira o `?conta=provada` da barra, sem recarregar e sem entrada nova no histórico: fica no histórico do computador compartilhado e valeria de novo a cada F5. */
function tirarAContaDaBarra(): void {
  const endereco = new URL(window.location.href)
  if (!endereco.searchParams.has(PARAMETRO_DA_CONTA_PROVADA)) return
  endereco.searchParams.delete(PARAMETRO_DA_CONTA_PROVADA)
  window.history.replaceState(null, '', `${endereco.pathname}${endereco.search}${endereco.hash}`)
}

/** O código em branco: o aluno apertou "Abrir a turma" sem digitar. */
const CODIGO_EM_BRANCO = 'Digite o código da turma que o professor mostrou.'

/** A volta do provedor sem o caminho da sala (guardado, do mesmo slug e de até 15 min), ou o pedido que a API recusou por conta vencida: o aluno recomeça pelo link ou pelo código. */
const CONTA_PERDIDA = 'Comece de novo pelo link ou pelo código da sala'

const CLASSES_DO_AVISO = 'rounded-controle border border-erro bg-erro-cx p-4 break-words text-erro'

/**
 * A página pública da turma, `/e/<slug>/turma` (A1, tarefa 17.0; RF10, RF11 e RF14; Tech Spec da A1, seções 5 e 9): o
 * aluno chega pelo link que o professor mandou ou digita o código projetado, escolhe o próprio nome entre os livres,
 * informa a matrícula e cria a senha. O pedido espera a aprovação de uma pessoa (D4).
 *
 * - **O token sai da barra antes da primeira chamada**, como o do convite: lido na primeira renderização, apagado no
 *   efeito que dispara a abertura. Outro link colado na aba (`hashchange`, também o mesmo de novo) recomeça a tela.
 * - **Nada fica no navegador.** Os nomes, a matrícula, a senha e a `chaveEnvio` vivem só no estado da página, fora do
 *   cache do TanStack Query e de todo armazenamento, e saem com a etapa: depois do envio, o aluno seguinte no mesmo
 *   computador não vê nada do anterior. Por isso as duas chamadas não passam pelo `useQuery`: o token iria para a chave
 *   ou o fecho de uma consulta guardada, e a página não tem sessão que a esvazie.
 * - **Cada abertura tem a sua vez** (`vez`): a resposta de uma abertura anterior — o código de antes, o link de antes —
 *   que chega depois não troca a turma da tela. O envio do nome também confere a vez em que saiu.
 * - **O texto do `NAO_ENCONTRADO` é o do caminho usado** (W9): o servidor responde igual ao link e ao código.
 * - **A conta da escola (acesso-e-convites, 16.0; RF14):** com o provedor liberado, o botão de `ContaDaEscolaNaSala` leva o aluno a provar a conta. A única coisa que fica no
 *   navegador é o caminho da sala (token ou código), no `sessionStorage` da aba por até 15 min, e só na ida ao provedor (`caminho-da-sala.ts`): a volta, `?conta=provada`, o lê, e a
 *   primeira renderização o apaga e tira o parâmetro da barra. Com a conta provada o formulário não tem senha, e o pedido sai sem ela. O domínio não liberado, a conta pessoal e
 *   a queda do provedor não voltam aqui: a API os leva à entrada da escola (divergência da 16.0).
 */
export function TurmaPublica({ slug }: { slug: string }) {
  usePageTitle('Entrar na turma')
  // O token (ou a volta do provedor) é lido na primeira renderização, e o efeito tira o fragmento da barra antes da primeira chamada sair.
  const [comeco] = useState(() => comecar(slug))
  const [etapa, definirEtapa] = useState<Etapa>(comeco.etapa)
  const [codigoDigitado, definirCodigoDigitado] = useState('')
  // Sobe a cada vez que a tela leva o aluno ao campo do código: o campo pega o foco também quando já estava na tela.
  const [focoNoCodigo, definirFocoNoCodigo] = useState(comeco.foco)
  const vez = useRef(0)
  const codigoNoAr = useRef(false)

  const mostrarCodigo = useCallback((aviso?: string) => {
    definirEtapa(aviso === undefined ? { nome: 'codigo', abrindo: false } : { nome: 'codigo', aviso, abrindo: false })
    definirFocoNoCodigo((anterior) => anterior + 1)
  }, [])

  /**
   * Lê a turma pelo caminho, na vez dada: a resposta de uma vez que já passou não muda nada. `recarga` é a lista relida
   * depois de uma recusa (o nome pode ter sido tomado): a tela continua com o formulário, e só os nomes mudam. `conta` é a volta do
   * provedor: o pedido do nome sairá sem senha, e a falha de rede oferece "Tentar de novo" também pelo código, porque o aluno não digitou nada.
   */
  const buscar = useCallback(
    async (caminho: Caminho, minhaVez: number, recarga: boolean, conta: boolean): Promise<void> => {
      try {
        const resposta = await abrirSala({ slug, ...noPedido(caminho) })
        if (vez.current !== minhaVez) return
        definirEtapa({ nome: 'aberta', caminho, turma: resposta.turma.nome, nomes: resposta.nomes, conta })
      } catch (erro) {
        if (vez.current !== minhaVez) return
        const codigo = codigoDoErro(erro)
        // O acesso que não vale (vencido, revogado, refeito) leva ao código, com o texto do caminho que a página usou.
        if (codigo === ErrorCode.NAO_ENCONTRADO) mostrarCodigo(mensagemDaSala(codigo, { caminho: caminho.tipo }))
        // A recarga que cai por outro motivo deixa a lista de antes: o aviso da recusa já diz o que fazer.
        else if (recarga) return
        else if (caminho.tipo === 'codigo' && !conta) mostrarCodigo(mensagemDaSala(codigo, { caminho: 'codigo', esperaSegundos: esperaDoErro(erro), esgotado: true }))
        else definirEtapa({ nome: 'falhou', caminho, erro, conta })
      }
    },
    [slug, mostrarCodigo],
  )

  /** Abre a turma numa vez nova: o que estava no ar com a vez anterior é descartado quando volta. */
  const abrir = useCallback(
    (caminho: Caminho, opcoes: { readonly recarga?: boolean; readonly conta?: boolean } = {}): Promise<void> => {
      const { recarga = false, conta = false } = opcoes
      const minhaVez = ++vez.current
      if (!recarga) definirEtapa(caminho.tipo === 'link' || conta ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
      return buscar(caminho, minhaVez, recarga, conta)
    },
    [buscar],
  )

  // A primeira abertura, pelo link ou pela volta do provedor, com a tela já em "Abrindo a turma…"; e a página que sai descarta o que estiver no ar.
  // O fragmento, o `?conta=provada` e o caminho guardado saem aqui, volte ou não o provedor: o colega que abre a sala na mesma aba depois não herda nada.
  useEffect(() => {
    const contador = vez
    clearFragment()
    tirarAContaDaBarra()
    apagarCaminhoDaSala()
    if (comeco.abrir !== undefined) void buscar(comeco.abrir.caminho, ++contador.current, false, comeco.abrir.conta)
    return () => {
      contador.current++
    }
  }, [comeco, buscar])

  // Outro link colado nesta aba muda só o `#`, sem recarregar: a tela recomeça por ele, e o que estava digitado sai.
  useEffect(() => {
    function aoMudarOFragmento(): void {
      const token = readFragmentToken()
      clearFragment()
      definirCodigoDigitado('')
      if (token !== undefined) {
        void abrir({ tipo: 'link', token })
        return
      }
      vez.current++
      mostrarCodigo()
    }
    window.addEventListener('hashchange', aoMudarOFragmento)
    return () => window.removeEventListener('hashchange', aoMudarOFragmento)
  }, [abrir, mostrarCodigo])

  /**
   * O código digitado: normalizado como a API o confere, e o que não tem a forma de um código nem sai daqui — não gasta
   * a contagem da escola nem o limite por IP com o erro de digitação. Uma abertura por vez: o segundo Enter de um
   * clique duplo chega antes de a tela desligar o botão.
   */
  function abrirPeloCodigo(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (codigoNoAr.current) return
    const codigo = normalizarCodigoDaTurma(codigoDigitado)
    if (codigo === '') {
      mostrarCodigo(CODIGO_EM_BRANCO)
      return
    }
    if (!codigoDaTurmaValido(codigo)) {
      mostrarCodigo(MENSAGENS_DA_SALA.codigoNaoEncontrado)
      return
    }
    codigoNoAr.current = true
    void abrir({ tipo: 'codigo', codigo }).finally(() => {
      codigoNoAr.current = false
    })
  }

  /** "Usar outro código": a turma aberta sai, e o que estava no ar com ela é descartado. */
  function usarOutroCodigo(): void {
    vez.current++
    definirCodigoDigitado('')
    mostrarCodigo()
  }

  return (
    <CascaPublica titulo="Entrar na turma">
      {etapa.nome === 'codigo' && (
        <FormularioDoCodigo
          focar={focoNoCodigo}
          valor={codigoDigitado}
          aoMudar={definirCodigoDigitado}
          aviso={etapa.aviso}
          abrindo={etapa.abrindo}
          aoEnviar={abrirPeloCodigo}
        />
      )}
      {etapa.nome === 'abrindo' && <LoadingState rotulo="Abrindo a turma…" />}
      {etapa.nome === 'falhou' && <FalhaDoLink caminho={etapa.caminho.tipo} erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho, { conta: etapa.conta })} />}
      {etapa.nome === 'aberta' && (
        <TurmaAberta
          slug={slug}
          etapa={etapa}
          vezAgora={() => vez.current}
          aoEnviar={() => definirEtapa({ nome: 'enviado', caminho: etapa.caminho, conta: etapa.conta })}
          aoRecarregar={() => void abrir(etapa.caminho, { recarga: true, conta: etapa.conta })}
          aoPerderOAcesso={() => mostrarCodigo(mensagemDaSala(ErrorCode.NAO_ENCONTRADO, { caminho: etapa.caminho.tipo }))}
          aoPerderAConta={() => mostrarCodigo(CONTA_PERDIDA)}
          aoUsarOutroCodigo={usarOutroCodigo}
        />
      )}
      {/* "Voltar à lista de nomes" abre a sala sem `conta`, de propósito: o cookie da conta provada foi apagado no envio, e a lista volta ao formulário de matrícula e senha. */}
      {etapa.nome === 'enviado' && <PedidoEnviado slug={slug} conta={etapa.conta} aoVoltar={() => void abrir(etapa.caminho)} />}
    </CascaPublica>
  )
}

/**
 * A turma aberta: o título, a conta da escola (o botão que a prova, ou o aviso de que já foi provada), os nomes livres com o formulário, e a saída "Usar outro código".
 * Sem nome livre não há formulário nem botão da conta: o aluno só pode chamar o professor.
 */
function TurmaAberta(props: {
  readonly slug: string
  readonly etapa: Extract<Etapa, { nome: 'aberta' }>
  readonly vezAgora: () => number
  readonly aoEnviar: () => void
  readonly aoRecarregar: () => void
  readonly aoPerderOAcesso: () => void
  readonly aoPerderAConta: () => void
  readonly aoUsarOutroCodigo: () => void
}) {
  const { slug, etapa, aoUsarOutroCodigo, ...formulario } = props
  const { caminho, conta, nomes, turma } = etapa
  return (
    <>
      <TituloDaTurma turma={turma} />
      {nomes.length > 0 && !conta && <ContaDaEscolaNaSala slug={slug} caminho={caminho} />}
      {nomes.length > 0 && conta && (
        <p role="status" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          Conta da escola confirmada. Escolha o seu nome e informe a matrícula: não precisa criar senha.
        </p>
      )}
      {nomes.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-cartao border border-linha bg-superficie p-4">
          <p className="font-medium">Nenhum nome livre nesta turma.</p>
          <p className="text-apoio">Se o seu nome não aparece, chame o professor.</p>
        </div>
      ) : (
        <FormularioDoNome slug={slug} caminho={caminho} conta={conta} nomes={nomes} {...formulario} />
      )}
      <div>
        <button type="button" onClick={aoUsarOutroCodigo} className={SECONDARY_BUTTON_CLASSES}>
          Não é a sua turma? Usar outro código
        </button>
      </div>
    </>
  )
}

/**
 * O título da turma aberta, com o foco quando ela aparece: o campo do código ou o "Abrindo a turma…" que tinha o foco saiu
 * da tela. Cada abertura inteira passa antes por outra etapa e monta o título de novo; a lista relida depois de uma
 * recusa não, e o foco fica na matrícula.
 */
function TituloDaTurma({ turma }: { turma: string }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
  }, [])
  return (
    <h2 ref={titulo} tabIndex={-1} className="text-lg font-semibold break-words">
      Turma {turma}
    </h2>
  )
}

/** O campo do código (W11): maiúsculas no teclado do celular, sem corretor, e o aviso ligado ao campo. */
function FormularioDoCodigo({
  focar,
  valor,
  aoMudar,
  aviso,
  abrindo,
  aoEnviar,
}: {
  /** Sobe quando a tela pede o foco no campo: o código que não achou turma, o link que não vale, "Usar outro código". */
  readonly focar: number
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  readonly aviso: string | undefined
  readonly abrindo: boolean
  readonly aoEnviar: (evento: FormEvent<HTMLFormElement>) => void
}) {
  const idDoAviso = useId()
  const idDoStatus = useId()
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focar > 0) campo.current?.focus()
  }, [focar])
  return (
    <form className="flex flex-col gap-4" onSubmit={aoEnviar} noValidate>
      <p className="text-apoio">Digite o código da turma que o professor mostrou.</p>
      <FormField
        ref={campo}
        rotulo="Código da turma"
        dica="São 8 letras e números. Pode digitar com ou sem o espaço do meio."
        name="codigo"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={TAMANHO_MAXIMO_CODIGO_DIGITADO}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        descritoTambemPor={`${idDoAviso} ${idDoStatus}`}
      />
      {aviso !== undefined && (
        <p id={idDoAviso} role="alert" className={CLASSES_DO_AVISO}>
          {aviso}
        </p>
      )}
      <Button type="submit" disabled={abrindo} className="w-full">
        {abrindo ? 'Abrindo…' : 'Abrir a turma'}
      </Button>
      <span id={idDoStatus} role="status" className="sr-only">
        {abrindo ? 'Abrindo a turma…' : ''}
      </span>
    </form>
  )
}

/** O link (ou a volta do provedor) que não abriu por rede, servidor ou limite. O `NAO_ENCONTRADO` não chega aqui: ele leva ao código. */
function FalhaDoLink({ caminho, erro, aoTentarDeNovo }: { caminho: Caminho['tipo']; erro: unknown; aoTentarDeNovo: () => void }) {
  return (
    <div className="rounded-cartao border border-erro bg-erro-cx p-4">
      <p role="alert" className="break-words text-erro">
        {mensagemDaSala(codigoDoErro(erro), { caminho, esperaSegundos: esperaDoErro(erro), esgotado: true })}
      </p>
      <div className="mt-3">
        <Button onClick={aoTentarDeNovo}>Tentar de novo</Button>
      </div>
    </div>
  )
}

/**
 * Os nomes livres, a matrícula e a senha (W11), num envio só (W8). A chave de envio é sorteada a cada envio novo e
 * reaproveitada só no "Tentar de novo" do mesmo pedido, depois de o sistema ficar cheio: se um envio anterior chegou a
 * gravar, o servidor responde `enviado` sem pedido novo (E21).
 */
function FormularioDoNome(props: {
  readonly slug: string
  readonly caminho: Caminho
  /** O aluno provou a conta da escola: não há campo de senha, e o pedido sai sem ela (a conta vem do cookie, no servidor). */
  readonly conta: boolean
  readonly nomes: readonly NomeLivre[]
  readonly vezAgora: () => number
  readonly aoEnviar: () => void
  readonly aoRecarregar: () => void
  readonly aoPerderOAcesso: () => void
  /** A API recusou a conta (cookie vencido, ausente ou de outra sala): a prova se refaz pelo link ou pelo código. */
  readonly aoPerderAConta: () => void
}) {
  const { slug, caminho, conta, nomes, vezAgora, aoEnviar, aoRecarregar, aoPerderOAcesso, aoPerderAConta } = props
  const [escolhido, definirEscolhido] = useState<string | undefined>(undefined)
  const [matricula, definirMatricula] = useState('')
  const [senha, definirSenha] = useState('')
  const [aviso, definirAviso] = useState<string | undefined>(undefined)
  const [tentando, definirTentando] = useState(false)
  const [enviando, definirEnviando] = useState(false)
  const [cheio, definirCheio] = useState(false)
  const [faltaONome, definirFaltaONome] = useState(false)
  // O `ref` trava na hora o segundo clique de um clique duplo, que chega antes de a tela desligar o botão.
  const noAr = useRef(false)
  // O pedido que ficou sem resposta porque o sistema estava cheio: o "Tentar de novo" manda ele, com a mesma chave.
  const semResposta = useRef<ReivindicarSalaRequest | undefined>(undefined)
  const campoDaMatricula = useRef<HTMLInputElement>(null)
  // O foco vai ao primeiro nome quando falta escolher: o leitor de tela lê o grupo com o aviso que o descreve.
  const primeiroNome = useRef<HTMLInputElement>(null)
  const idDoAviso = useId()
  const idDoStatus = useId()
  const idDaFaltaDoNome = useId()
  // A lista relida depois de uma recusa pode não ter mais o nome escolhido: ele sai da escolha.
  const nomeEscolhido = nomes.find((nome) => nome.id === escolhido)

  /** Mexer num campo depois do sistema cheio faz o próximo envio ser um pedido novo, com chave nova. */
  function mudou(): void {
    definirCheio(false)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (noAr.current) return
    if (nomeEscolhido === undefined) {
      definirFaltaONome(true)
      primeiroNome.current?.focus()
      return
    }
    // A matrícula vai como foi digitada: o contrato tira o espaço das pontas, como na lista (`matriculaDigitadaSchema`).
    const anterior = semResposta.current
    const senhaDoPedido = conta ? undefined : senha
    const mesmoPedido = anterior !== undefined && anterior.listaNomeId === nomeEscolhido.id && anterior.matricula === matricula && anterior.senha === senhaDoPedido
    const pedido: ReivindicarSalaRequest = mesmoPedido
      ? anterior
      : { slug, ...noPedido(caminho), listaNomeId: nomeEscolhido.id, matricula, ...(senhaDoPedido === undefined ? {} : { senha: senhaDoPedido }), chaveEnvio: crypto.randomUUID() }
    noAr.current = true
    definirEnviando(true)
    definirAviso(undefined)
    definirCheio(false)
    const minhaVez = vezAgora()
    const desfecho = await enviarComReenvio(() => reivindicarNome(pedido), {
      esperar: (ms) => new Promise((resolver) => window.setTimeout(resolver, ms)),
      aleatorio: Math.random,
      aoEsperar: () => definirTentando(true),
      valendo: () => vezAgora() === minhaVez,
    })
    // Outro link, outro código ou a página fechada enquanto o envio estava no ar: a tela já é outra.
    if (desfecho.tipo === 'descartado') return
    noAr.current = false
    definirEnviando(false)
    definirTentando(false)
    semResposta.current = desfecho.tipo === 'cheio' ? pedido : undefined
    if (desfecho.tipo === 'enviado') {
      aoEnviar()
      return
    }
    if (desfecho.tipo === 'cheio') {
      definirCheio(true)
      definirAviso(MENSAGENS_DA_SALA.cheio)
      return
    }
    const codigo = codigoDoErro(desfecho.erro)
    if (codigo === ErrorCode.NAO_ENCONTRADO) {
      aoPerderOAcesso()
      return
    }
    // Sem senha, o `ENTRADA_INVALIDA` é a conta que não vale mais para esta sala (os campos já saem conferidos daqui): provar de novo.
    if (conta && codigo === ErrorCode.ENTRADA_INVALIDA) {
      aoPerderAConta()
      return
    }
    definirAviso(mensagemDaSala(codigo, { caminho: caminho.tipo, esperaSegundos: esperaDoErro(desfecho.erro) }))
    if (codigo === ErrorCode.REIVINDICACAO_RECUSADA) {
      // A recusa não diz se foi o nome ou a matrícula: a lista é relida (o nome pode ter sido tomado), a senha digitada
      // sai, e o foco vai para a matrícula, que é o que o texto pede para conferir.
      definirSenha('')
      aoRecarregar()
      campoDaMatricula.current?.focus()
    }
  }

  const descritoPor = `${idDoAviso} ${idDoStatus}`

  return (
    <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={faltaONome && nomeEscolhido === undefined ? idDaFaltaDoNome : undefined}>
        <legend className="mb-2 font-medium">
          Escolha o seu nome
        </legend>
        {nomes.map((nome, posicao) => (
          <label key={nome.id} className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-cartao border bg-superficie px-4 py-2 ${nome.id === escolhido ? 'border-noite' : 'border-linha'}`}>
            <input
              ref={posicao === 0 ? primeiroNome : undefined}
              type="radio"
              name="nome"
              value={nome.id}
              checked={nome.id === escolhido}
              onChange={() => {
                definirEscolhido(nome.id)
                mudou()
              }}
              className="h-5 w-5 shrink-0 accent-noite"
            />
            <span className="min-w-0 break-words">{nome.nome}</span>
          </label>
        ))}
        {faltaONome && nomeEscolhido === undefined && (
          <p id={idDaFaltaDoNome} className="text-sm text-erro">
            Escolha o seu nome na lista.
          </p>
        )}
      </fieldset>
      <p className="text-apoio">Se o seu nome não aparece, chame o professor.</p>
      <FormField
        ref={campoDaMatricula}
        rotulo="Matrícula"
        name="matricula"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={TAMANHO_MAXIMO_MATRICULA}
        value={matricula}
        onChange={(evento) => {
          definirMatricula(evento.target.value)
          mudou()
        }}
        descritoTambemPor={descritoPor}
      />
      {!conta && (
        <PasswordInput
          rotulo="Crie uma senha"
          dica={`Pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres. Use uma frase que só você saiba: é com ela e com a matrícula que você vai entrar.`}
          name="senha"
          // `off`, e não `new-password`: o computador é da escola, e o navegador não pode oferecer guardar a senha do aluno
          // para o próximo que sentar ali (W11).
          autoComplete="off"
          required
          minLength={TAMANHO_MINIMO_SENHA_NOVA}
          maxLength={TAMANHO_MAXIMO_SENHA}
          value={senha}
          onChange={(evento) => {
            definirSenha(evento.target.value)
            mudou()
          }}
        />
      )}
      {aviso !== undefined && (
        <p id={idDoAviso} role="alert" className={CLASSES_DO_AVISO}>
          {aviso}
        </p>
      )}
      <span id={idDoStatus} role="status" className={tentando ? 'rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente' : 'sr-only'}>
        {tentando ? MENSAGENS_DA_SALA.tentandoDeNovo : enviando ? 'Enviando…' : ''}
      </span>
      <Button type="submit" disabled={enviando} aria-describedby={descritoPor} className="w-full">
        {enviando ? 'Enviando…' : cheio ? 'Tentar de novo' : 'Enviar pedido'}
      </Button>
    </form>
  )
}

/**
 * Depois do pedido (W8): o que acontece agora, e por que a entrada responde "matrícula ou senha incorretas" até a
 * aprovação (R5). A decisão é de uma pessoa, e a recusa devolve o nome à lista (nota da 8.0). Nada do pedido aparece
 * aqui: nem o nome, nem a matrícula — o próximo aluno pode usar o mesmo computador.
 */
function PedidoEnviado({ slug, conta, aoVoltar }: { slug: string; conta: boolean; aoVoltar: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
  }, [])
  return (
    <section aria-labelledby="titulo-do-pedido" className="flex flex-col gap-4">
      <h2 id="titulo-do-pedido" ref={titulo} tabIndex={-1} className="text-lg font-semibold">
        Pedido enviado
      </h2>
      <p>Agora o seu pedido espera o professor. Quem aprova ou recusa é uma pessoa: o professor da turma ou a coordenação.</p>
      <p className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {conta
          ? 'Espere o professor aprovar. Até lá, entrar com a conta da escola diz que ela não está liberada. Não é erro: depois da aprovação você entra por ela.'
          : 'Até a aprovação, a entrada da escola responde “Matrícula ou senha incorretas”. Não é erro: é só esperar o professor aprovar.'}
      </p>
      <p className="text-apoio">Se o pedido for recusado, o seu nome volta para a lista, e você pode pedir de novo.</p>
      <Link to={caminhoDaEscola(slug)} className={SECONDARY_LINK_CLASSES}>
        Ir para a entrada da escola
      </Link>
      <button type="button" onClick={aoVoltar} className={SECONDARY_BUTTON_CLASSES}>
        Voltar à lista de nomes
      </button>
    </section>
  )
}
