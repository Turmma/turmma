import type { EtapaDeLogin, PapelDeUsuario } from '@educa/shared'

/**
 * A base da área de cada papel (`docs/interface.md` 11.1). Cada área vem num chunk próprio, por `import()`, e só depois
 * de a guarda de papel de `routes.tsx` conferir que a sessão é daquele papel: o professor que digita o endereço da
 * coordenação vê "Página não encontrada" e não baixa nada da área dela.
 */
export const BASE_DA_AREA: Readonly<Record<PapelDeUsuario, string>> = { coordenador: '/coordenacao', professor: '/professor', aluno: '/aluno' }

/** As rotas da área do professor, relativas à base dela (o `Route` aninhado de `routes.tsx`). */
export const ROTAS_DO_PROFESSOR = {
  /** "Início" (era "Nova conversa"), a Home: a caixa de pedido do Assistente de ensino. É onde o professor abre (A2; D73; `docs/interface.md` 11.2). */
  novaConversa: '/nova-conversa',
  /** A conversa da professora com o Assistente: uma thread só, dela (A2; 11.3). */
  conversa: '/conversa',
  /** O catálogo de ferramentas, nas categorias da D74, e o que já foi gerado. */
  ferramentas: '/ferramentas',
  /** O formulário de uma ferramenta: o mesmo motor do cartão da conversa (D18). */
  ferramenta: '/ferramentas/:ferramenta',
  /** Criados (telas do professor, 5.0): o que a professora já gerou, por turma, com os filtros de tipo, turma e estado no endereço. */
  criados: '/criados',
  /** Um artefato aberto: a atividade ou o plano, com a página de origem e as versões adaptadas. */
  artefato: '/artefatos/:artefatoId',
  /** O que o Assistente de ensino fez (pelo pé do sino): o que as funções dele fizeram e o que espera a professora (11.4). */
  timeDoAssistente: '/time/assistente',
  /** O que o Tutor viu (pelo pé do sino): os sinais e o uso do Tutor pela turma, sem conversa de aluno (A4; 11.4). */
  timeDoTutor: '/time/tutor',
  /** Aprovar a correção de objetiva de uma atividade aplicada: os destaques e o registro da validação (A3; 11.5). */
  aprovar: '/aprovar/:atividadeAplicadaId',
  /** As turmas e disciplinas que a coordenação alocou: confirmar ou contestar cada uma (F1, RF4 e D73). */
  turmas: '/turmas',
  /** Uma turma aberta dentro de Turmas, com o acesso dos alunos (A1, 15.0; RF9) e, na 16.0, os pedidos. */
  turma: '/turmas/:turmaId',
  /** "Meus dados", no menu da pessoa: os pedidos de cópia dos próprios dados e o arquivo, para baixar (F3, 18.0; RF12 e RF20). */
  meusDados: '/meus-dados',
  /** A introdução do professor, em tela de foco: a casca sem lateral nem barras (telas do aluno e primeiro acesso, 2.0; a tela é da 10.0). */
  bemVindo: '/bem-vindo',
} as const

/** O endereço da turma aberta pelo professor, **relativo à área**, como o da Estrutura (`caminhoDaTurmaNaEstrutura`). */
export function caminhoDaTurmaDoProfessor(turmaId: string): string {
  return ROTAS_DO_PROFESSOR.turma.replace(':turmaId', encodeURIComponent(turmaId))
}

/** O endereço do formulário de uma ferramenta, **relativo à área**. */
export function caminhoDaFerramentaDoProfessor(ferramenta: string): string {
  return ROTAS_DO_PROFESSOR.ferramenta.replace(':ferramenta', encodeURIComponent(ferramenta))
}

/** O nome do parâmetro que leva a atividade de origem ao formulário da Adaptação: o id do artefato, e nada sobre aluno. */
export const PARAMETRO_DA_ORIGEM = 'origem'

/** O endereço da Adaptação já com a atividade de origem escolhida, **relativo à área**: é o "Pedir versão adaptada" do artefato. */
export function caminhoDaAdaptacaoDoArtefato(artefatoId: string): string {
  return `${caminhoDaFerramentaDoProfessor('adaptacao')}?${PARAMETRO_DA_ORIGEM}=${encodeURIComponent(artefatoId)}`
}

/** O endereço de um artefato aberto, **relativo à área**. */
export function caminhoDoArtefatoDoProfessor(artefatoId: string): string {
  return ROTAS_DO_PROFESSOR.artefato.replace(':artefatoId', encodeURIComponent(artefatoId))
}

/** O endereço da correção de uma atividade aplicada, **relativo à área**: é o "Revisar" de "O que o Assistente fez". */
export function caminhoDaCorrecaoDoProfessor(atividadeAplicadaId: string): string {
  return ROTAS_DO_PROFESSOR.aprovar.replace(':atividadeAplicadaId', encodeURIComponent(atividadeAplicadaId))
}

/** As rotas da área da coordenação, relativas à base dela. */
export const ROTAS_DA_COORDENACAO = {
  /** O Painel: os números da IA na escola, o que espera pela coordenação e o que falta para terminar a escola (X2, 2.0; RF6). */
  painel: '/painel',
  /** A governança de IA: o que a IA gerou e quem aprovou, e o consumo. É onde a coordenação abre (MVP, A5; `docs/interface.md` 11.1 e 11.7). */
  governanca: '/governanca',
  /** Os três agentes e as funções de cada um, com a suspensão por função (MVP, A5; D9, D60). */
  agentes: '/agentes',
  /** O resumo do Analista de desempenho escolar, em agregado (MVP, A5; D45). */
  analista: '/analista',
  /** Onde a escola se monta: ano letivo, séries, disciplinas, turmas e alocação (A1, 13.0; `docs/interface.md` 3 e 11.1). */
  estrutura: '/estrutura',
  /** Uma turma aberta dentro de Estrutura, com a lista de nomes dela (13.0) e, na 16.0, os pedidos. */
  turma: '/estrutura/turmas/:turmaId',
  /** Os professores da escola e o convite de cada um: cadastrar, copiar o link, refazer e revogar (A1, 14.0; RF6). */
  professores: '/professores',
  /** O material da escola: enviar o PDF com a licença declarada e acompanhar a leitura (MVP, A2; D75). */
  material: '/material',
  /** "Seus dados e a lei", no grupo Conformidade: as abas da Privacidade ficam no endereço (F3, 6.0; `docs/interface.md` 3). */
  privacidade: '/privacidade',
  /** Os pedidos de titular, a aba Pedidos de Registros (X2, 3.0). Sem este caminho, `/privacidade` redireciona para ele. */
  pedidos: '/privacidade/pedidos',
  /** Uma aba da Privacidade pelo endereço dela. Existem `pedidos`, `retencao`, `suboperadores` e `incidentes`. */
  privacidadeDaAba: '/privacidade/:aba',
  /** Um pedido de titular aberto, dentro da aba Pedidos da Privacidade (F3, 17.0). O id é o do pedido, nunca nome nem matrícula. */
  pedidoDoTitular: '/privacidade/pedidos/:pedidoId',
  /** A introdução da coordenação, em tela de foco: a casca sem lateral nem barras (telas do aluno e primeiro acesso, 2.0; a tela é da 11.0). */
  bemVindo: '/bem-vindo',
} as const

/**
 * O endereço da turma aberta na Estrutura, **relativo à área**: o link sai de dentro do `Route` aninhado em `/coordenacao`,
 * onde o wouter resolve o `to` a partir da base da área.
 */
export function caminhoDaTurmaNaEstrutura(turmaId: string): string {
  return ROTAS_DA_COORDENACAO.turma.replace(':turmaId', encodeURIComponent(turmaId))
}

/** O nome do parâmetro que abre o painel do professor em Professores (X2, 6.0): o endereço o escreve, e a tela o lê, por este nome só. */
export const PARAMETRO_DO_PROFESSOR = 'professor'

/** O nome do parâmetro que abre o painel do material em Material (X2, 8.0): só o id do material vai ao endereço, nunca o título (regra 20, item 9). */
export const PARAMETRO_DO_MATERIAL = 'material'

/**
 * O endereço de Professores com o professor aberto, **relativo à área**: só o id do usuário vai na consulta, nunca o nome (regra
 * 20, item 9). É o que a fila do sino e a lista de professores da turma usam para levar ao painel dele (X2, 9.0; o painel é o da 6.0).
 */
export function caminhoDoProfessor(usuarioId: string): string {
  return `${ROTAS_DA_COORDENACAO.professores}?${PARAMETRO_DO_PROFESSOR}=${encodeURIComponent(usuarioId)}`
}

/** O endereço de uma aba da Privacidade, **relativo à área**, como `caminhoDaTurmaNaEstrutura`: é o que a aba usa para trocar de aba. */
export function caminhoDaAbaDaPrivacidade(aba: string): string {
  return ROTAS_DA_COORDENACAO.privacidadeDaAba.replace(':aba', encodeURIComponent(aba))
}

/** O endereço do pedido de titular aberto, **relativo à área**. O id vai codificado: nada além dele entra no endereço (regra 20, item 9). */
export function caminhoDoPedidoDoTitular(pedidoId: string): string {
  return ROTAS_DA_COORDENACAO.pedidoDoTitular.replace(':pedidoId', encodeURIComponent(pedidoId))
}

/**
 * As três telas que a aba Privacidade de Registros escolhe num seletor (X2, 3.0): os prazos de guarda, as empresas que recebem
 * dados e os incidentes, cada uma no endereço que já tinha (`/privacidade/<id>`). Os pedidos são a aba ao lado e não entram.
 */
export const TELAS_DO_SELETOR_DA_PRIVACIDADE = ['retencao', 'suboperadores', 'incidentes'] as const
export type TelaDoSeletorDaPrivacidade = (typeof TELAS_DO_SELETOR_DA_PRIVACIDADE)[number]

/** O valor do endereço é uma das três telas do seletor? */
export function ehTelaDoSeletorDaPrivacidade(valor: string): valor is TelaDoSeletorDaPrivacidade {
  return (TELAS_DO_SELETOR_DA_PRIVACIDADE as readonly string[]).includes(valor)
}

/** As rotas da área do aluno, relativas à base dela. */
export const ROTAS_DO_ALUNO = {
  /** "Início": a faixa de supervisão e a escolha da atividade. É onde o aluno abre (telas do aluno e primeiro acesso, 2.0; `docs/interface.md` 11.1). */
  inicio: '/inicio',
  /** O Tutor, que continua abrindo pelo endereço de hoje: a escolha da atividade. Dentro de "Início" na lateral. */
  tutor: '/tutor',
  /** A conversa com o Tutor numa atividade: é por atividade que a conversa existe. */
  tutorDaAtividade: '/tutor/:atividadeAplicadaId',
  /** "Tarefas" (era "Atividades"): o que a professora atribuiu à turma do aluno, com o estado de cada uma. O endereço de hoje (MVP, A3). */
  atividades: '/atividades',
  /** Uma atividade aberta: uma questão por vez e, depois de aprovada a correção, o diagnóstico. */
  atividade: '/atividades/:atividadeAplicadaId',
  /** "Eu": a turma, a série e a escola dele, e as linhas Privacidade e Sair. Era "Minha turma" (A1, 12.0; RF13), cujo endereço leva para cá. */
  eu: '/eu',
  /** O endereço de "Minha turma" até a X4: não é mais tela, e redireciona para `eu`, sem ficar no histórico. */
  minhaTurma: '/minha-turma',
  /** "Privacidade", com "Meus dados" (F3, 18.0; RF12 e RF20): a linha de Eu a abre, e Eu fica selecionado nela. */
  privacidade: '/privacidade',
  /** A introdução do aluno, em tela de foco: a casca sem lateral nem barras (2.0; a tela é da 9.0). */
  bemVindo: '/bem-vindo',
} as const

/** O endereço de uma atividade aberta pelo aluno, **relativo à área**. */
export function caminhoDaAtividadeDoAluno(atividadeAplicadaId: string): string {
  return ROTAS_DO_ALUNO.atividade.replace(':atividadeAplicadaId', encodeURIComponent(atividadeAplicadaId))
}

/** O nome do parâmetro que leva ao Tutor a questão em que o aluno estava: só o número dela. */
export const PARAMETRO_DA_QUESTAO = 'questao'

/**
 * O endereço da conversa com o Tutor numa atividade, **relativo à área**; com a questão, é o "Pedir ajuda ao Tutor nesta
 * questão". Vão só o id da atividade e o número da questão: nada do que o aluno marcou nem escreveu.
 */
export function caminhoDoTutorNaAtividade(atividadeAplicadaId: string, questao?: number): string {
  const caminho = ROTAS_DO_ALUNO.tutorDaAtividade.replace(':atividadeAplicadaId', encodeURIComponent(atividadeAplicadaId))
  return questao === undefined ? caminho : `${caminho}?${PARAMETRO_DA_QUESTAO}=${String(questao)}`
}

/** Os endereços da web, num lugar só. */
export const ROTAS = {
  inicio: '/',
  entrar: '/entrar',
  /** O endereço da escola, por onde o aluno entra (RF7). O slug vem do parâmetro da rota. */
  escola: '/e/:slug',
  /**
   * A página pública da turma, por onde o aluno reivindica o nome (A1, 17.0): o link da sala (`#<token>`) ou o código
   * digitado. O token vai no fragmento, como o do convite, e nunca no caminho nem na consulta.
   */
  salaDaTurma: '/e/:slug/turma',
  mfa: '/mfa',
  configurarMfa: '/mfa/configurar',
  escolherEscola: '/escolher-escola',
  /** "Início" do professor, pela raiz: é onde ele abre (A2), e o endereço que a navegação usa. */
  novaConversa: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.novaConversa}`,
  /** A conversa com o Assistente, pela raiz: dentro dela, "Início" continua selecionado na lateral. */
  conversa: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.conversa}`,
  /** "Ferramentas" do professor, pela raiz. */
  ferramentas: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.ferramentas}`,
  /** "Criados" do professor, pela raiz (telas do professor, 5.0): é o endereço que a navegação usa. */
  criados: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.criados}`,
  /** Os artefatos abertos, pela raiz: dentro deles, "Ferramentas" continua selecionado na lateral. */
  artefatos: `${BASE_DA_AREA.professor}/artefatos`,
  /** "Turmas" do professor, pela raiz: é o endereço que a navegação usa. */
  turmas: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.turmas}`,
  /** "Meus dados" do professor, pela raiz: é o endereço do link do menu da pessoa (F3, 18.0). */
  meusDadosDoProfessor: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.meusDados}`,
  /** O Painel da coordenação, pela raiz (X2, 2.0). Entra na lateral na 3.0, que também o faz o lugar onde ela abre. */
  painel: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.painel}`,
  /** Governança da coordenação, pela raiz: é o endereço que a navegação usa, e onde a coordenação abre (MVP, A5). */
  governanca: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.governanca}`,
  /** Agentes da coordenação, pela raiz (MVP, A5). */
  agentes: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.agentes}`,
  /** Analista da coordenação, pela raiz (MVP, A5). */
  analista: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.analista}`,
  /** Estrutura da coordenação, pela raiz: é o endereço que a navegação usa (13.0). */
  estrutura: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.estrutura}`,
  /** Professores da coordenação, pela raiz: é o endereço que a navegação usa (14.0). */
  professores: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.professores}`,
  /** Material da coordenação, pela raiz: é o endereço que a navegação usa (MVP, A2). */
  material: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.material}`,
  /** Privacidade da coordenação, pela raiz: é o endereço que a navegação usa (F3, 6.0). */
  privacidade: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.privacidade}`,
  /** "Início" do aluno, pela raiz: é onde ele abre (telas do aluno e primeiro acesso, 2.0), e o endereço que a navegação usa. As chaves do aluno levam `DoAluno`: `inicio` já é a raiz `/`. */
  inicioDoAluno: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.inicio}`,
  /** O Tutor do aluno, pela raiz: a escolha da atividade, dentro de "Início" na lateral. */
  tutor: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.tutor}`,
  /** "Tarefas" do aluno (era "Atividades"), pela raiz: o endereço que a navegação usa (MVP, A3). */
  atividades: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.atividades}`,
  /** "Eu" do aluno, pela raiz: é o endereço que a navegação usa. */
  euDoAluno: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.eu}`,
  /** "Privacidade" do aluno, pela raiz: a linha de Eu a abre, e Eu fica selecionado nela (F3, 18.0). */
  privacidadeDoAluno: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.privacidade}`,
  /** A introdução de cada papel, pela raiz: telas de foco (`ehTelaDeFoco`). */
  bemVindoDoAluno: `${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.bemVindo}`,
  bemVindoDoProfessor: `${BASE_DA_AREA.professor}${ROTAS_DO_PROFESSOR.bemVindo}`,
  bemVindoDaCoordenacao: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.bemVindo}`,
  /** O convite da coordenação e o do professor. O token vai no fragmento `#`, e nunca no caminho nem na consulta. */
  convite: '/convite',
  /** Estado do sistema, público: é a tela que se abre justamente quando não se consegue entrar. */
  sistema: '/sistema',
  /**
   * A galeria das peças (`gallery/Gallery.tsx`): fora da navegação, sem sessão e sem API, só com dado inventado. Existe
   * para o e2e provar as peças antes de as telas existirem; ninguém chega a ela por um link do produto.
   */
  galeria: '/galeria',
} as const

/**
 * Os endereços de tela de foco: a casca some a lateral e as barras, e fica só o conteúdo, o "Sair" e o relógio de
 * inatividade (telas do aluno e primeiro acesso, Tech Spec seção 5). Hoje são as três introduções, uma por papel; a
 * prova em tela de foco (F6) entra aqui quando chegar.
 */
const TELAS_DE_FOCO: readonly string[] = [ROTAS.bemVindoDoAluno, ROTAS.bemVindoDoProfessor, ROTAS.bemVindoDaCoordenacao]

/** O caminho é o de uma tela de foco? Só o endereço exato: `/aluno/bem-vindo-velho` e `/aluno/bem-vindo/x` são outra coisa. */
export function ehTelaDeFoco(caminho: string): boolean {
  return TELAS_DE_FOCO.includes(caminho)
}

/**
 * O endereço da sala da turma, por onde o aluno reivindica o nome: `/e/<slug>/turma` (Tech Spec da A1, seção 4). O token
 * do link vai no fragmento `#`, como o do convite, e nunca no caminho nem na consulta.
 */
export function caminhoDaSala(slug: string): string {
  return ROTAS.salaDaTurma.replace(':slug', encodeURIComponent(slug))
}

/** O endereço da escola, onde o aluno aprovado entra com a matrícula e a senha (RF7 do F1). */
export function caminhoDaEscola(slug: string): string {
  return ROTAS.escola.replace(':slug', encodeURIComponent(slug))
}

/**
 * A tela de cada etapa que o login pode devolver (Tech Spec, seção 5, "Etapas"). `pronta` já tem sessão e vai para
 * a área autenticada; as outras seguem para a tela da etapa, sem sessão nenhuma gravada.
 */
export const ROTA_DA_ETAPA: Readonly<Record<EtapaDeLogin, string>> = {
  pronta: ROTAS.inicio,
  mfa: ROTAS.mfa,
  configurar_mfa: ROTAS.configurarMfa,
  escolher: ROTAS.escolherEscola,
}
