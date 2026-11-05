import { ErrorCode, type CandidatoDaMarca, type ErroDaImportacao, type MarcasDaPlanilha, type PreviaDaPlanilhaResponse, type PreviaDaPlanilhaRow, type ResultadoDaLinhaDaPlanilha, type ResumoDaImportacao } from '@educa/shared'
import { ApiError } from '../../../api/client'
import { errorText } from '../../../components/error-text'
import { formatQuantity } from '../../../format'
import { ImportacaoNaoConcluidaError } from './api/importacao'
import type { MotivoDaPlanilhaRecusada } from './ler-planilha'

/**
 * O que a prévia da planilha diz à coordenação (F2, 13.0; RF2 a RF4; Tech Spec, seção 9), fora da tela para ser provado sem navegador.
 * A API dá o resultado de cada linha, as contagens e os candidatos a marca; aqui ficam o texto de cada código, a ordem (erros e
 * avisos primeiro, o resto em contagem), a paginação, o que segura a gravação e o que a tela diz ao terminar.
 *
 * Nenhuma regra de negócio mora aqui: quem classifica a linha, quem é candidato e o que o gravar faz com a marca é da API. A tela só
 * diz isso em português, com o que fazer (regra 50, item 12).
 */

/** Quantos itens de cada lista a tela mostra por vez (Tech Spec, seção 9): a planilha de 3.000 linhas com erro em todas não vira 3.000 cartões. */
export const ITENS_POR_PAGINA = 100

/** O erro de cada linha em texto, sem código, com o que fazer. Código que a tela ainda não conhece cai no último. */
export const TEXTO_DO_ERRO_DA_LINHA: Readonly<Record<string, string>> = {
  turma_vazia: 'Falta a turma. Escreva a turma desta linha, como "8º A".',
  turma_invalida: 'Não achei esta turma. Escreva o ano e a letra, como "8º A" ou "1º B" (6º ao 9º ano do Fundamental, 1º ao 3º do Médio).',
  turma_ambigua: 'Duas turmas da escola têm este nome. Renomeie uma delas na aba Turmas e envie a planilha de novo.',
  sem_nome: 'Falta o nome do aluno. Preencha a coluna "nome".',
  nome_invalido: 'O nome passa de 200 caracteres ou tem um caractere que não é texto. Confira o nome.',
  sem_matricula: 'Falta a matrícula. Preencha a coluna "matricula".',
  matricula_invalida: 'A matrícula passa de 40 caracteres ou tem um caractere que não é texto. Confira a matrícula.',
  matricula_notacao_cientifica:
    'A matrícula virou notação científica (como 1E+10) quando a planilha foi salva em CSV. No Excel, deixe a coluna como texto e salve de novo, ou envie o arquivo .xlsx.',
  matricula_parece_documento: 'Parece CPF ou data de nascimento, e não matrícula: confira esta linha e troque pela matrícula da escola.',
  matricula_repetida: 'Esta matrícula aparece em mais de uma linha da planilha. Cada aluno tem uma só: corrija ou tire as repetidas.',
  aluno_desativado: 'Este aluno está desligado da escola, e a planilha não o traz de volta. Tire esta linha da planilha.',
  linha_incompleta: 'Esta linha não tem as colunas do modelo. Confira se cada dado está na sua coluna, sem ponto e vírgula dentro do nome.',
}

/** O texto de um erro que a tela ainda não sabe dizer: a linha segura a gravação, e o texto manda conferi-la. */
export const TEXTO_DO_ERRO_DESCONHECIDO = 'Esta linha tem um problema que a tela ainda não sabe dizer. Confira os dados dela e envie a planilha de novo.'

export const textoDoErro = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_ERRO_DA_LINHA[codigo]) ?? TEXTO_DO_ERRO_DESCONHECIDO

/** O aviso de uma linha que grava assim mesmo (professor em duas turmas no mesmo horário, na grade). Código desconhecido cai no último. */
export const TEXTO_DO_AVISO_DA_LINHA: Readonly<Record<string, string>> = {}
export const TEXTO_DO_AVISO_DESCONHECIDO = 'Confira esta linha: ela é gravada como está, mas parece fora do comum.'

export const textoDoAviso = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_AVISO_DA_LINHA[codigo]) ?? TEXTO_DO_AVISO_DESCONHECIDO

/**
 * O que a contagem do resto diz de cada resultado, no singular e no plural. A ordem é a da frase. `erro` não está aqui: tem lista
 * própria. O `nome_corrigido` e o `muda_de_turma` dizem por extenso o que acontece (a ponte da A1 os recusava): o primeiro **grava**,
 * o segundo só com a marca.
 */
const FRASE_DO_RESULTADO: Readonly<Record<Exclude<ResultadoDaLinhaDaPlanilha, 'erro'>, readonly [string, string]>> = {
  entra: ['entra', 'entram'],
  volta: ['volta de um ano anterior, para a turma que a linha escreve', 'voltam de um ano anterior, para a turma que cada linha escreve'],
  novo: ['é novo', 'são novos'],
  nome_corrigido: ['tem o nome corrigido para o da planilha', 'têm o nome corrigido para o da planilha'],
  muda_de_turma: ['aparece em outra turma (só muda com a sua marca)', 'aparecem em outra turma (só mudam com a sua marca)'],
  fora_da_planilha: ['não está na planilha (só sai com a sua marca)', 'não estão na planilha (só saem com a sua marca)'],
  sai_da_grade: ['sai da grade (só com a sua marca)', 'saem da grade (só com a sua marca)'],
  ja_existe: ['já existe, e nada muda', 'já existem, e nada muda'],
}

const ORDEM_DAS_FRASES = ['entra', 'volta', 'novo', 'nome_corrigido', 'muda_de_turma', 'fora_da_planilha', 'sai_da_grade', 'ja_existe'] as const satisfies readonly Exclude<ResultadoDaLinhaDaPlanilha, 'erro'>[]

/** Quantas linhas de cada resultado a prévia tem. */
export function contarPorResultado(linhas: readonly PreviaDaPlanilhaRow[]): Readonly<Partial<Record<ResultadoDaLinhaDaPlanilha, number>>> {
  const contagem: Partial<Record<ResultadoDaLinhaDaPlanilha, number>> = {}
  for (const { resultado } of linhas) contagem[resultado] = (contagem[resultado] ?? 0) + 1
  return contagem
}

/** A contagem do resto numa frase por resultado, na ordem da tela. Resultado que não houve não aparece. */
export function frasesDoResto(linhas: readonly PreviaDaPlanilhaRow[]): string[] {
  const contagem = contarPorResultado(linhas)
  return ORDEM_DAS_FRASES.flatMap((resultado) => {
    const quantas = contagem[resultado] ?? 0
    return quantas === 0 ? [] : [formatQuantity(quantas, `linha ${FRASE_DO_RESULTADO[resultado][0]}`, `linhas ${FRASE_DO_RESULTADO[resultado][1]}`)]
  })
}

/** As linhas que a tela mostra uma a uma, cada grupo na ordem da planilha: os erros e, depois, os avisos (linha sem erro, com aviso). */
export function linhasDeErroEDeAviso(linhas: readonly PreviaDaPlanilhaRow[]): { readonly erros: PreviaDaPlanilhaRow[]; readonly avisos: PreviaDaPlanilhaRow[] } {
  const pelaLinha = (a: PreviaDaPlanilhaRow, b: PreviaDaPlanilhaRow) => a.linha - b.linha
  return {
    erros: linhas.filter((linha) => linha.resultado === 'erro').sort(pelaLinha),
    avisos: linhas.filter((linha) => linha.resultado !== 'erro' && linha.aviso !== undefined).sort(pelaLinha),
  }
}

/** A fatia da lista que a tela mostra: `paginas` páginas de 100 do começo. */
export const fatiaDaLista = <T>(itens: readonly T[], paginas: number): T[] => itens.slice(0, paginas * ITENS_POR_PAGINA)

/** Quantos itens a lista ainda esconde. */
export const itensEscondidos = (total: number, paginas: number): number => Math.max(0, total - paginas * ITENS_POR_PAGINA)

/**
 * As três marcas que a coordenação pode dar (PRD, RF4; Tech Spec, seção 5). Cada uma diz o que fica sem ela, em palavras que a
 * escola entende: a planilha **confere**, e quem muda de turma, sai ou deixa a grade é escolha da coordenação (regra 70, item 2;
 * TODO.md, "Da 10.0": "volta" e "desligar" não são o resultado automático da planilha).
 */
export const ACOES_DE_MARCA = ['transferir', 'desligar', 'encerrar'] as const
export type AcaoDeMarca = (typeof ACOES_DE_MARCA)[number]

export interface TextoDoGrupoDeMarca {
  readonly titulo: string
  readonly explicacao: string
  readonly rotuloDoTodos: string
}

export const TEXTO_DO_GRUPO_DE_MARCA: Readonly<Record<AcaoDeMarca, TextoDoGrupoDeMarca>> = {
  transferir: {
    titulo: 'Aparecem em outra turma na planilha',
    explicacao:
      'A matrícula destes alunos está em outra turma da escola, e a planilha os põe nesta. Marque só quem você quer transferir: o trabalho feito fica na turma antiga, e quem você não marcar continua onde está.',
    rotuloDoTodos: 'Marcar todos para transferir',
  },
  desligar: {
    titulo: 'Estão nas turmas da planilha, mas não aparecem nela',
    explicacao:
      'Marque só quem saiu da escola: o aluno desligado perde o acesso. Quem você não marcar continua na escola, mesmo ausente da planilha.',
    rotuloDoTodos: 'Marcar todos para desligar',
  },
  encerrar: {
    titulo: 'Saem da grade nova',
    explicacao: 'O vínculo destes professores com a turma e a disciplina não aparece na grade nova. Marque só os que você quer encerrar: quem você não marcar continua.',
    rotuloDoTodos: 'Marcar todos para encerrar',
  },
}

/**
 * Por que a lista de marcas existe. Aparece em todo grupo: o rótulo de cada pessoa vem do que a escola já tem cadastrado, comparado
 * com a planilha, e a decisão é de quem confere (regra 70, itens 2 e 3; D44).
 */
export const TEXTO_DA_CONFERENCIA =
  'Esta lista é uma conferência feita a partir da planilha, não um resultado automático. Cada pessoa só é transferida, desligada ou tirada da grade se você marcar, e a sua escolha fica registrada.'

export type MarcasEscolhidas = Readonly<Record<AcaoDeMarca, ReadonlySet<string>>>

export const SEM_MARCAS: MarcasEscolhidas = { transferir: new Set(), desligar: new Set(), encerrar: new Set() }

/** Os candidatos da prévia de uma ação, na ordem em que a API os deu. */
export const candidatosDa = (candidatos: readonly CandidatoDaMarca[], acao: AcaoDeMarca): CandidatoDaMarca[] => candidatos.filter((candidato) => candidato.acao === acao)

/** As marcas no corpo do gravar: ids, nunca nome nem matrícula (`docs/lgpd.md`). */
export function marcasParaEnviar(escolhidas: MarcasEscolhidas): MarcasDaPlanilha {
  return { transferir: [...escolhidas.transferir], desligar: [...escolhidas.desligar], encerrar: [...escolhidas.encerrar] }
}

export const totalDeMarcas = (escolhidas: MarcasEscolhidas): number => escolhidas.transferir.size + escolhidas.desligar.size + escolhidas.encerrar.size

/** Marca ou desmarca um candidato, sem mexer na marcação anterior. */
export function alternarMarca(escolhidas: MarcasEscolhidas, acao: AcaoDeMarca, id: string): MarcasEscolhidas {
  const doGrupo = new Set(escolhidas[acao])
  if (doGrupo.has(id)) doGrupo.delete(id)
  else doGrupo.add(id)
  return { ...escolhidas, [acao]: doGrupo }
}

/** "Marcar todos" de uma ação: marca todos os candidatos dela, inclusive os de páginas que a tela ainda não abriu; marcado todos, desmarca todos. */
export function alternarTodos(escolhidas: MarcasEscolhidas, acao: AcaoDeMarca, candidatos: readonly CandidatoDaMarca[]): MarcasEscolhidas {
  const doGrupo = candidatosDa(candidatos, acao)
  const todos = doGrupo.length > 0 && doGrupo.every(({ id }) => escolhidas[acao].has(id))
  return { ...escolhidas, [acao]: todos ? new Set<string>() : new Set(doGrupo.map(({ id }) => id)) }
}

/** O motivo que a tela dá quando a prévia não pode ser gravada. */
export const MOTIVO_DO_ERRO_NA_PLANILHA = 'Corrija as linhas com erro na planilha e escolha o arquivo de novo: nada é gravado enquanto houver erro.'
export const MOTIVO_DO_DOCUMENTO = 'Nada é gravado enquanto a coluna da matrícula parecer CPF ou data de nascimento.'
export const MOTIVO_DE_NADA_NOVO = 'Nada novo para gravar: tudo o que a planilha traz já está na escola. Marque quem muda de turma ou sai, se for o caso.'

/**
 * A gravação que a tela oferece: sem linha de erro (a API recusaria), com algo a fazer (uma linha que grava, ou ao menos uma marca).
 * Se todo erro é de coluna que parece documento, o motivo é o da coluna (regra 20, item 2), sem repetir o texto de cada linha.
 */
export function podeGravar(previa: Pick<PreviaDaPlanilhaResponse, 'linhas'>, marcas: number): { readonly pode: true } | { readonly pode: false; readonly motivo: string } {
  const erros = previa.linhas.filter((linha) => linha.resultado === 'erro')
  if (erros.length > 0) return { pode: false, motivo: erros.every((linha) => linha.erro === 'matricula_parece_documento') ? MOTIVO_DO_DOCUMENTO : MOTIVO_DO_ERRO_NA_PLANILHA }
  const grava = previa.linhas.some((linha) => linha.resultado === 'entra' || linha.resultado === 'nome_corrigido' || linha.resultado === 'volta' || linha.resultado === 'novo')
  if (!grava && marcas === 0) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
  return { pode: true }
}

/** As linhas que a prévia prometia e a gravação não fez, por quê: sem a marca da coordenação, ou porque a escola mudou entre a prévia e o gravar. */
export interface LinhasDeFora {
  /** Linhas "aparece em outra turma" que a coordenação não marcou: a transferência só vale com a marca. */
  readonly semMarca: number
  /** Linhas que a prévia dizia que gravavam, e o `resumo` não contou: o gravar refaz a prévia, e a matrícula já não servia. */
  readonly mudaram: number
}

/**
 * O que a tela diz ao terminar: quantas entraram e quantas ficaram de fora. O que a gravação fez sai das contagens do `resumo`, que
 * a API guarda só em números (regra 20, item 9), e a tela não afirma "nenhuma linha ficou de fora" quando a conta não fecha.
 */
export function textoDaConclusao(resumo: ResumoDaImportacao | null, deFora: LinhasDeFora): string {
  const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
  const contagens: readonly (readonly [number, string, string])[] = [
    [n('entram') + n('voltam'), 'aluno entrou', 'alunos entraram'],
    [n('nomes_corrigidos'), 'nome foi corrigido', 'nomes foram corrigidos'],
    [n('transferidos'), 'aluno mudou de turma', 'alunos mudaram de turma'],
    [n('desligados') + n('retirados'), 'aluno saiu', 'alunos saíram'],
    [n('turmas_novas'), 'turma nova foi criada', 'turmas novas foram criadas'],
  ]
  // "Quantos entraram" sempre aparece, mesmo zero; o resto só quando houve.
  const partes = contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
  const deForaPorQue = [
    [deFora.semMarca, 'o aluno aparece em outra turma e você não marcou a transferência.'],
    [deFora.mudaram, 'a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.'],
  ] as const
  const deForaDitas = deForaPorQue.flatMap(([quantas, porque]) => (quantas === 0 ? [] : [`${formatQuantity(quantas, 'linha ficou de fora', 'linhas ficaram de fora')}: ${porque}`]))
  partes.push(...(deForaDitas.length === 0 ? ['Nenhuma linha ficou de fora.'] : deForaDitas))
  return partes.join(' ')
}

/**
 * Quantas linhas ficaram de fora e por quê: as "aparece em outra turma" sem marca, e as que a prévia dava como gravadas (entra, volta
 * ou nome corrigido) menos as que o `resumo` diz que foram. As chaves do `resumo` são as do tipo `alunos`; a 14.0 e a 15.0 dizem as dos
 * tipos delas.
 */
export function linhasDeFora(linhas: readonly PreviaDaPlanilhaRow[], marcas: MarcasEscolhidas, resumo: ResumoDaImportacao | null): LinhasDeFora {
  const contagem = contarPorResultado(linhas)
  const naPrevia = (...resultados: ResultadoDaLinhaDaPlanilha[]): number => resultados.reduce((soma, resultado) => soma + (contagem[resultado] ?? 0), 0)
  const noResumo = (...chaves: (keyof ResumoDaImportacao)[]): number => chaves.reduce((soma, chave) => soma + (resumo?.[chave] ?? 0), 0)
  return {
    semMarca: Math.max(0, naPrevia('muda_de_turma') - marcas.transferir.size),
    mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
  }
}

/**
 * O que as marcas escolhidas vão fazer ao gravar, em uma frase, para a coordenação ler antes de confirmar (regra 50, item 8): o "marcar
 * todos" também marca quem a tela ainda não abriu. Sem marca, não há frase.
 */
export function resumoDasMarcas(marcas: MarcasEscolhidas): string | undefined {
  const frases = [
    [marcas.transferir.size, 'aluno mudará de turma', 'alunos mudarão de turma'],
    [marcas.desligar.size, 'aluno será desligado e perde o acesso', 'alunos serão desligados e perdem o acesso'],
    [marcas.encerrar.size, 'vínculo de professor será encerrado', 'vínculos de professor serão encerrados'],
  ] as const
  const ditas = frases.flatMap(([quantos, um, varios]) => (quantos === 0 ? [] : [formatQuantity(quantos, um, varios)]))
  return ditas.length === 0 ? undefined : `Ao gravar, com as suas marcas: ${ditas.join('; ')}.`
}

/** O que a tela diz da planilha que não virou texto, com o que fazer (regra 50, item 12). */
export const TEXTO_DA_PLANILHA_RECUSADA: Readonly<Record<MotivoDaPlanilhaRecusada, string>> = {
  grande: 'A planilha é grande demais para um envio só (o limite é 512 KB). Divida em partes e envie uma de cada vez.',
  linhas: 'A planilha passa de 3.000 linhas. Divida em partes e envie uma de cada vez.',
  ilegivel: 'Não foi possível ler este arquivo. Escolha o arquivo de novo.',
  formato: 'Este arquivo não é uma planilha que a tela leia. Salve a planilha como Excel (.xlsx) ou como CSV e escolha o arquivo de novo.',
  leitor: 'Não foi possível carregar o leitor de planilhas do Excel. Confira a conexão e escolha o arquivo de novo, ou salve a planilha como CSV.',
}

/** O que o servidor recusou na prévia: o cabeçalho que não é o do modelo, ou o texto fora dos tetos. */
const TEXTO_DA_PREVIA_RECUSADA = 'Não deu para ler a planilha. Confira se a primeira linha é o cabeçalho do modelo, se há ao menos uma linha de dados e se ela não passa de 3.000 linhas.'

/** A falha da prévia em texto. `textos` são os da tela que usa a peça (a lista da turma diz "esta turma", a planilha da escola não). */
export function textoDaFalhaDaPrevia(erro: unknown, textos: Partial<Record<ErrorCode, string>> = {}): string {
  return errorText(erro, { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DA_PREVIA_RECUSADA, ...textos })
}

/** O que a importação que não concluiu diz, por causa: `falhou` tem o código de lista fechada, e `desatualizada` é outra coisa. */
const TEXTO_DA_IMPORTACAO_QUE_FALHOU: Readonly<Record<ErroDaImportacao, string>> = {
  expirou: 'A importação ficou tempo demais na fila e foi cancelada. Nada foi gravado: grave de novo.',
  trava_esgotada: 'A escola estava ocupada demais para gravar agora (alguém gerando acesso ou decidindo pedidos). Nada foi gravado: tente de novo em alguns minutos.',
  erro_interno: 'Não foi possível terminar a gravação. Nada foi gravado: tente de novo em alguns minutos.',
}

export const TEXTO_DA_IMPORTACAO_DESATUALIZADA =
  'A escola mudou desde a prévia: alguém mexeu nos alunos enquanto você conferia. Nada foi gravado. Escolha o arquivo de novo para ver a prévia de agora.'

/** O `CONFLITO` do gravar: outra importação da escola ainda não terminou. A prévia continua valendo. */
export const TEXTO_DO_CONFLITO_DO_GRAVAR = 'Outra importação desta escola ainda está em andamento. Nada foi gravado: espere ela terminar e grave de novo.'

/**
 * A falha da gravação em texto: o `CONFLITO` do POST ("outra importação da escola está na fila"), a importação `desatualizada` ("a
 * lista mudou desde a prévia") e a que `falhou` dizem coisas diferentes, e cada uma diz o que fazer.
 */
export function textoDaFalhaDaGravacao(erro: unknown, textos: Partial<Record<ErrorCode, string>> = {}): string {
  if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada' ? TEXTO_DA_IMPORTACAO_DESATUALIZADA : TEXTO_DA_IMPORTACAO_QUE_FALHOU[erro.erro ?? 'erro_interno']
  return errorText(erro, {
    [ErrorCode.CONFLITO]: TEXTO_DO_CONFLITO_DO_GRAVAR,
    [ErrorCode.ENTRADA_INVALIDA]: 'A planilha tem uma linha com erro que a prévia não mostrou. Nada foi gravado: escolha o arquivo de novo.',
    ...textos,
  })
}

/** A prévia deixou de valer, e a tela a tira: a importação desatualizada, ou o gravar recusado porque a planilha ou a escola mudou. */
export function previaEnvelheceu(erro: unknown): boolean {
  if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada'
  return erro instanceof ApiError && (erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.NAO_ENCONTRADO)
}
