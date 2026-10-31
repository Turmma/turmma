import {
  ErrorCode,
  codigoDaTurmaValido,
  MENSAGENS_DA_SALA,
  mensagemDaSala,
  normalizarCodigoDaTurma,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
  TAMANHO_MAXIMO_MATRICULA,
  TAMANHO_MAXIMO_SENHA,
  TAMANHO_MINIMO_SENHA_NOVA,
  type ReivindicarSalaRequest,
  type SalaAbertaResponse,
} from '@educa/shared'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { ErroDaApi } from '../api/client'
import { abrirSala, reivindicarNome } from '../api/salas'
import { caminhoDaEscola } from '../paths'
import { Botao } from '../components/ui/Botao'
import { CLASSES_DO_BOTAO_SECUNDARIO, CLASSES_DO_LINK_SECUNDARIO } from '../components/ui/button-variants'
import { Campo } from '../components/ui/fields/Campo'
import { CampoDeSenha } from '../components/ui/fields/CampoDeSenha'
import { CascaPublica } from '../components/CascaPublica'
import { EstadoCarregando } from '../components/states'
import { useTituloDaTela } from '../document-title'
import { apagarFragmentoDaBarra, tokenDoFragmento } from './url-fragment'
import { enviarComReenvio } from './retry-with-backoff'

/** Por onde a página chegou à turma: o link do professor, com o token, ou o código que o aluno digitou. */
type Caminho = { readonly tipo: 'link'; readonly token: string } | { readonly tipo: 'codigo'; readonly codigo: string }

type NomeLivre = SalaAbertaResponse['nomes'][number]

type Etapa =
  /** O campo do código: sem link, com o link que não vale, ou com o código que não achou turma. */
  | { readonly nome: 'codigo'; readonly aviso?: string; readonly abrindo: boolean }
  /** O link abrindo a turma. */
  | { readonly nome: 'abrindo' }
  /** O link que não abriu por rede, servidor ou limite: "Tentar de novo" usa o token que ficou na memória. */
  | { readonly nome: 'falhou'; readonly caminho: Extract<Caminho, { tipo: 'link' }>; readonly erro: unknown }
  | { readonly nome: 'aberta'; readonly caminho: Caminho; readonly turma: string; readonly nomes: readonly NomeLivre[] }
  | { readonly nome: 'enviado'; readonly caminho: Caminho }

const codigoDoErro = (erro: unknown): ErrorCode => (erro instanceof ErroDaApi ? erro.codigo : ErrorCode.ERRO_INTERNO)
const esperaDoErro = (erro: unknown): number | undefined => (erro instanceof ErroDaApi ? erro.esperaSegundos : undefined)

/** O caminho como o contrato o leva: o token **ou** o código, nunca os dois. */
const noPedido = (caminho: Caminho): { token: string } | { codigo: string } => (caminho.tipo === 'link' ? { token: caminho.token } : { codigo: caminho.codigo })

/** O código em branco: o aluno apertou "Abrir a turma" sem digitar. */
const CODIGO_EM_BRANCO = 'Digite o código da turma que o professor mostrou.'

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
 */
export function TurmaPublica({ slug }: { slug: string }) {
  useTituloDaTela('Entrar na turma')
  // O token é lido na primeira renderização, e o efeito tira o fragmento da barra antes da primeira chamada sair.
  const [tokenInicial] = useState(tokenDoFragmento)
  const [etapa, definirEtapa] = useState<Etapa>(() => (tokenInicial === undefined ? { nome: 'codigo', abrindo: false } : { nome: 'abrindo' }))
  const [codigoDigitado, definirCodigoDigitado] = useState('')
  // Sobe a cada vez que a tela leva o aluno ao campo do código: o campo pega o foco também quando já estava na tela.
  const [focoNoCodigo, definirFocoNoCodigo] = useState(0)
  const vez = useRef(0)
  const codigoNoAr = useRef(false)

  const mostrarCodigo = useCallback((aviso?: string) => {
    definirEtapa(aviso === undefined ? { nome: 'codigo', abrindo: false } : { nome: 'codigo', aviso, abrindo: false })
    definirFocoNoCodigo((anterior) => anterior + 1)
  }, [])

  /**
   * Lê a turma pelo caminho, na vez dada: a resposta de uma vez que já passou não muda nada. `recarga` é a lista relida
   * depois de uma recusa (o nome pode ter sido tomado): a tela continua com o formulário, e só os nomes mudam.
   */
  const buscar = useCallback(
    async (caminho: Caminho, minhaVez: number, recarga: boolean): Promise<void> => {
      try {
        const resposta = await abrirSala({ slug, ...noPedido(caminho) })
        if (vez.current !== minhaVez) return
        definirEtapa({ nome: 'aberta', caminho, turma: resposta.turma.nome, nomes: resposta.nomes })
      } catch (erro) {
        if (vez.current !== minhaVez) return
        const codigo = codigoDoErro(erro)
        // O acesso que não vale (vencido, revogado, refeito) leva ao código, com o texto do caminho que a página usou.
        if (codigo === ErrorCode.NAO_ENCONTRADO) mostrarCodigo(mensagemDaSala(codigo, { caminho: caminho.tipo }))
        // A recarga que cai por outro motivo deixa a lista de antes: o aviso da recusa já diz o que fazer.
        else if (recarga) return
        else if (caminho.tipo === 'codigo') mostrarCodigo(mensagemDaSala(codigo, { caminho: 'codigo', esperaSegundos: esperaDoErro(erro), esgotado: true }))
        else definirEtapa({ nome: 'falhou', caminho, erro })
      }
    },
    [slug, mostrarCodigo],
  )

  /** Abre a turma numa vez nova: o que estava no ar com a vez anterior é descartado quando volta. */
  const abrir = useCallback(
    (caminho: Caminho, recarga = false): Promise<void> => {
      const minhaVez = ++vez.current
      if (!recarga) definirEtapa(caminho.tipo === 'link' ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
      return buscar(caminho, minhaVez, recarga)
    },
    [buscar],
  )

  // A primeira abertura, pelo link, com a tela já em "Abrindo a turma…"; e a página que sai descarta o que estiver no ar.
  useEffect(() => {
    const contador = vez
    apagarFragmentoDaBarra()
    if (tokenInicial !== undefined) void buscar({ tipo: 'link', token: tokenInicial }, ++contador.current, false)
    return () => {
      contador.current++
    }
  }, [tokenInicial, buscar])

  // Outro link colado nesta aba muda só o `#`, sem recarregar: a tela recomeça por ele, e o que estava digitado sai.
  useEffect(() => {
    function aoMudarOFragmento(): void {
      const token = tokenDoFragmento()
      apagarFragmentoDaBarra()
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
      {etapa.nome === 'abrindo' && <EstadoCarregando rotulo="Abrindo a turma…" />}
      {etapa.nome === 'falhou' && <FalhaDoLink erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho)} />}
      {etapa.nome === 'aberta' && (
        <>
          <TituloDaTurma turma={etapa.turma} />
          {etapa.nomes.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-cartao border border-linha bg-superficie p-4">
              <p className="font-medium">Nenhum nome livre nesta turma.</p>
              <p className="text-apoio">Se o seu nome não aparece, chame o professor.</p>
            </div>
          ) : (
            <FormularioDoNome
              slug={slug}
              caminho={etapa.caminho}
              nomes={etapa.nomes}
              vezAgora={() => vez.current}
              aoEnviar={() => definirEtapa({ nome: 'enviado', caminho: etapa.caminho })}
              aoRecarregar={() => void abrir(etapa.caminho, true)}
              aoPerderOAcesso={() => mostrarCodigo(mensagemDaSala(ErrorCode.NAO_ENCONTRADO, { caminho: etapa.caminho.tipo }))}
            />
          )}
          <div>
            <button type="button" onClick={usarOutroCodigo} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Não é a sua turma? Usar outro código
            </button>
          </div>
        </>
      )}
      {etapa.nome === 'enviado' && <PedidoEnviado slug={slug} aoVoltar={() => void abrir(etapa.caminho)} />}
    </CascaPublica>
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
      <Campo
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
      <Botao type="submit" disabled={abrindo} className="w-full">
        {abrindo ? 'Abrindo…' : 'Abrir a turma'}
      </Botao>
      <span id={idDoStatus} role="status" className="sr-only">
        {abrindo ? 'Abrindo a turma…' : ''}
      </span>
    </form>
  )
}

/** O link que não abriu por rede, servidor ou limite. O `NAO_ENCONTRADO` não chega aqui: ele leva ao código. */
function FalhaDoLink({ erro, aoTentarDeNovo }: { erro: unknown; aoTentarDeNovo: () => void }) {
  return (
    <div className="rounded-cartao border border-erro bg-erro-cx p-4">
      <p role="alert" className="break-words text-erro">
        {mensagemDaSala(codigoDoErro(erro), { caminho: 'link', esperaSegundos: esperaDoErro(erro), esgotado: true })}
      </p>
      <div className="mt-3">
        <Botao onClick={aoTentarDeNovo}>Tentar de novo</Botao>
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
  readonly nomes: readonly NomeLivre[]
  readonly vezAgora: () => number
  readonly aoEnviar: () => void
  readonly aoRecarregar: () => void
  readonly aoPerderOAcesso: () => void
}) {
  const { slug, caminho, nomes, vezAgora, aoEnviar, aoRecarregar, aoPerderOAcesso } = props
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
    const mesmoPedido = anterior !== undefined && anterior.listaNomeId === nomeEscolhido.id && anterior.matricula === matricula && anterior.senha === senha
    const pedido: ReivindicarSalaRequest = mesmoPedido ? anterior : { slug, ...noPedido(caminho), listaNomeId: nomeEscolhido.id, matricula, senha, chaveEnvio: crypto.randomUUID() }
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
      <Campo
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
      <CampoDeSenha
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
      {aviso !== undefined && (
        <p id={idDoAviso} role="alert" className={CLASSES_DO_AVISO}>
          {aviso}
        </p>
      )}
      <span id={idDoStatus} role="status" className={tentando ? 'rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente' : 'sr-only'}>
        {tentando ? MENSAGENS_DA_SALA.tentandoDeNovo : enviando ? 'Enviando…' : ''}
      </span>
      <Botao type="submit" disabled={enviando} aria-describedby={descritoPor} className="w-full">
        {enviando ? 'Enviando…' : cheio ? 'Tentar de novo' : 'Enviar pedido'}
      </Botao>
    </form>
  )
}

/**
 * Depois do pedido (W8): o que acontece agora, e por que a entrada responde "matrícula ou senha incorretas" até a
 * aprovação (R5). A decisão é de uma pessoa, e a recusa devolve o nome à lista (nota da 8.0). Nada do pedido aparece
 * aqui: nem o nome, nem a matrícula — o próximo aluno pode usar o mesmo computador.
 */
function PedidoEnviado({ slug, aoVoltar }: { slug: string; aoVoltar: () => void }) {
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
        Até a aprovação, a entrada da escola responde “Matrícula ou senha incorretas”. Não é erro: é só esperar o professor aprovar.
      </p>
      <p className="text-apoio">Se o pedido for recusado, o seu nome volta para a lista, e você pode pedir de novo.</p>
      <Link to={caminhoDaEscola(slug)} className={CLASSES_DO_LINK_SECUNDARIO}>
        Ir para a entrada da escola
      </Link>
      <button type="button" onClick={aoVoltar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
        Voltar à lista de nomes
      </button>
    </section>
  )
}
