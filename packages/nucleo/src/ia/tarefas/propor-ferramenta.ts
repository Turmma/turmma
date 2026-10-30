import { citacaoSchema, FERRAMENTAS_GERADORAS, MAXIMO_DE_CITACOES_POR_MENSAGEM, MAXIMO_DE_QUESTOES_POR_ATIVIDADE, TAMANHO_MAXIMO_DO_TEMA } from '@educa/shared'
import { z } from 'zod'
import {
  citacaoDaFrase,
  dadoEmJson,
  dadosDosTrechos,
  esquemaContextoDaTurma,
  esquemaTrecho,
  extrairFatos,
  fatoCitadoNoTexto,
  fraseMaisProxima,
  frasesDoMaterial,
  problemasDasCitacoes,
} from '../material.js'
import { PROMPT_PROPOR_FERRAMENTA } from '../prompts/propor-ferramenta.js'
import { definirTarefa } from '../tarefa.js'
import { cortar, normalizar } from '../texto.js'

export const esquemaEntradaDoAssistente = z.strictObject({
  /** O que o professor escreveu agora. Vai ao modelo como dado. */
  mensagem: z.string().min(1).max(2000),
  contexto: esquemaContextoDaTurma,
  /** Trechos do material que a busca achou para a mensagem; pode vir vazio. */
  trechos: z.array(esquemaTrecho).max(6),
  turnosAnteriores: z.array(z.strictObject({ autor: z.enum(['professor', 'assistente']), texto: z.string().min(1).max(2000) })).max(8),
  /**
   * O professor respondeu "só conversar" à proposta de ferramenta (D18): a saída é **sempre texto**, sobre o último
   * pedido dele, e nenhuma ferramenta é proposta de novo. Ausente ou falso, a tarefa escolhe entre propor e responder.
   */
  semProposta: z.boolean().optional(),
})
export type EntradaDoAssistente = z.infer<typeof esquemaEntradaDoAssistente>

/**
 * A proposta é o que a tela mostra como "quer abrir a ferramenta?" (D18): a ferramenta e o que deu para entender do
 * pedido, para o cartão já abrir preenchido. Nada é gerado antes do sim. É a parte da `PropostaDeFerramenta` do
 * contrato (`@educa/shared`) que o modelo consegue dar: a turma e a disciplina, quem acrescenta é o Assistente, da
 * mensagem do professor. Só as ferramentas que geram a partir de um tema: a Adaptação parte de uma atividade pronta
 * e tem rota própria, então pedido de adaptação vira texto que diz onde ela fica.
 */
export const esquemaPropostaDoAssistente = z.strictObject({
  ferramenta: z.enum(FERRAMENTAS_GERADORAS),
  parametros: z.strictObject({
    tema: z.string().min(1).max(TAMANHO_MAXIMO_DO_TEMA),
    quantidade: z.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE).optional(),
  }),
})
export type PropostaDoAssistente = z.infer<typeof esquemaPropostaDoAssistente>

/** Os mesmos dois tipos, e os mesmos tetos, do conteúdo que `mensagem_agente` guarda (`conteudoDaMensagemDoAgenteSchema`). */
export const esquemaSaidaDoAssistente = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('texto'), texto: z.string().min(1).max(8000), citacoes: z.array(citacaoSchema).max(MAXIMO_DE_CITACOES_POR_MENSAGEM) }),
  /** `texto` é a pergunta ao professor. */
  z.strictObject({ tipo: z.literal('proposta_de_ferramenta'), texto: z.string().min(1).max(1000), proposta: esquemaPropostaDoAssistente }),
])
export type SaidaDoAssistente = z.infer<typeof esquemaSaidaDoAssistente>

/**
 * A resposta fixa ao pedido de corrigir, avaliar, comentar ou dar nota a texto ou resposta de aluno (D55; regra 70,
 * item 2a). É texto nosso, não do modelo, e não repete nada do que o professor escreveu: se ele colou o texto de um
 * aluno, nem uma palavra dele volta. Rubrica e critérios, antes da aplicação, continuam sendo trabalho que o professor
 * pode pedir; julgar o texto do aluno, não.
 */
export const RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO =
  'Eu não corrijo nem avalio redação, resposta discursiva ou texto de aluno, não sugiro nota, conceito nem pontuação e não escrevo devolutiva sobre o que ele escreveu: essa correção é sua. O que eu preparo aqui é atividade objetiva, plano de aula e versão adaptada de atividade, sempre a partir do material da escola.'

/** "Notas de aula" e "nota de rodapé" não são nota de aluno: saem do texto antes de a regra olhar. */
const NOTA_QUE_NAO_E_DE_ALUNO = /\bnotas? (de aula|de rodape|explicativas?|fiscal|fiscais|musica\w*|tecnicas?|introdutorias?|historicas?|de corte)\b/g

/** Minúsculas, sem acento e sem o que não é nota de aluno: a forma em que as listas comparam. */
const paraARegra = (mensagem: string): string => normalizar(mensagem).replace(NOTA_QUE_NAO_E_DE_ALUNO, ' ')
/** Sem acento, **com** maiúscula: é por ela que o nome próprio aparece ("o texto do Lucas"). */
const semAcento = (mensagem: string): string => mensagem.normalize('NFD').replace(/\p{M}/gu, '')

/**
 * Pedido de **nota, conceito ou pontuação** à IA, ou de decidir se o aluno passa: recusa sozinho, sem precisar de outra
 * palavra. "Dê o conceito de mol" pede uma definição, e passa; "atividade sobre pontuação" é assunto de aula, e passa.
 */
const PEDE_NOTA = new RegExp(
  [
    String.raw`\b(que|qual|quanta) (seria |e |foi )?(a |uma |sua )?nota\b`,
    String.raw`\bnota (voce|vc|tu) `,
    String.raw`\b(da|de|dou) (uma |a |alguma |essa |sua )notas?\b`,
    String.raw`\b(dar|daria|darias|atribu\w*|sugir\w*|suger\w*|propo\w*|coloc\w*|lanc\w*|calcul\w*|defin\w*) (uma |a |as |alguma |essa |sua )?notas?\b`,
    String.raw`\bnotas? (de|entre) (0|zero|um|1) (a|e|ate) \w+`,
    String.raw`\bde (0|zero) a (10|dez|100|cem)\b`,
    String.raw`\bnotas? (para|pra|pro|d[oa]s?|dess[ea]s?|dest[ea]s?|ness[ea]s?|nest[ea]s?|niss[oa]|nist[oa]|que (ele|ela|o|a|ess|est))\b`,
    String.raw`\bnota (\d+|dez|nove|oito|maxima|maior|alta|baixa)\b`,
    String.raw`\bmerec\w*\b[^.?!]{0,30}\b(nota|conceito|pontos?|credito)\b`,
    String.raw`\b(nota|conceito)\b[^.?!]{0,20}\bmerec\w*`,
    String.raw`\bquanto\b[^.?!]{0,25}\b(vale|valeria|merece|mereceria|daria|tira|tiraria|tirou|tirariam)\b`,
    String.raw`\b(tira|tiraria|tirou|tirariam)\b[^.?!]{0,15}\bquanto\b`,
    String.raw`\bquantos pontos\b`,
    // "quanto eu devo dar pra essa resposta?", "quanto você dá?": o verbo de dar com quem dá; "quanto tempo devo dar" é outro assunto.
    String.raw`\bquanto (?!tempo\b|de tempo\b)[^.?!]{0,25}\b(devo dar|deveria dar|vou dar|posso dar|poderia dar|eu dou|eu poria|eu poderia por|voce da|vc da|voce poria|vc poria|voce colocaria|vc colocaria|voce botaria|vc botaria)\b`,
    String.raw`\bque numero (voce |vc |tu )?(da|daria|colocaria|poria|botaria|merece|atribuiria)\b`,
    String.raw`\bcredito (parcial|total|integral)\b`,
    String.raw`\b(passa|aprova\w*) ou (reprova\w*|nao)\b|\b(ele|ela|o aluno|a aluna) (passa|reprova|aprova)\b`,
    String.raw`\b(que|qual) (seria |e )?(o )?conceito (merec\w*|voce|vc|daria|dar|cabe|atribu\w*|para|pra|dess\w*|dest\w*|ness\w*|nest\w*|d[oa] (alun|text|respost|redac|trabalh))`,
    String.raw`\b(de|da|dou) (um |o |algum )conceito\b(?! (de|do|da)\b)`,
    String.raw`\b(dar|daria|atribu\w*|sugir\w*|suger\w*|propo\w*) (um |o |algum )?conceito\b(?! (de|do|da)\b)`,
    String.raw`\bconceito (de )?[a-e] (a|ou|ate) [a-e]\b`,
    String.raw`\b(que|qual) (seria |e )?(a )?pontuacao\b`,
    String.raw`\b(da|de|dar|daria|atribu\w*|sugir\w*|suger\w*|propo\w*) (uma |a )pontuacao\b`,
    String.raw`\bpontu(e|a|ar|aria|em) (ess|est|iss|ist|a respost|o text|a redac|o trabalh|a prov)`,
    String.raw`\bpontuacao (d[oa]s?|para|pra|dess[ea]|dest[ea]) (o |a |ess\w* |est\w* )?(alun|text|respost|redac|trabalh|produc)`,
  ].join('|'),
)
/** "nota?", "e o conceito?", "a nota dele?": a pergunta inteira é a nota. */
const SO_A_NOTA = /^(e )?(a |o |qual (a |o )?|e a |e o )?(nota|conceito|pontuacao|nivel)( dele| dela| final| disso| dessa| desse)?\s*\??$/
/** Escrever devolutiva, comentário ou parecer para entregar: é a devolutiva sobre o texto do aluno que a D55 proíbe. */
const ESCREVE_DEVOLUTIVA = /\b(faz|faca|fazer|escrev\w*|redij\w*|redig\w*|cri\w*|ger\w*|mont\w*|prepar\w*) (um |uma |o |a |os |as )?(\w+ )?(comentarios?|devolutivas?|feedbacks?|pareceres?|parecer)\b/

/** Pedido de **julgamento**: olhar, achar, conferir, classificar, ranquear, apontar ou marcar erro, aplicar a rubrica, dizer se está bom. */
const PEDE_JULGAMENTO = new RegExp(
  String.raw`\b(` +
    [
      String.raw`d[ae]r? uma (olhada|olhadinha|lida|conferida|revisada|corrigida|analisada|checada)`,
      String.raw`olha(da)? (ess|est|nes|iss|ist|aqui|so|o que)\w*`,
      String.raw`(ve|veja|ver) (se|ess\w*|est\w*|iss\w*|ist\w*|o que)`,
      String.raw`o que (voce |vc |tu )?(acha|achou|pensa|diz|me diz)`,
      String.raw`que (voce |vc )?(acha|achou)`,
      String.raw`analis\w*|avali\w*|corrig\w*|corrij\w*|correc\w*|pre-?correc\w*|coment\w*|confer\w*|chec\w*|classific\w*|ranque\w*|ranke\w*`,
      String.raw`(esta|estao|ta|tao|ficou|ficaram|e) (bom|boa|bons|boas|certo|certa|certos|certas|correto|correta|completo|completa|ok|adequad\w*|ruim|errad\w*|legal|coerent\w*|fraco|fraca|forte|melhor|pior|suficiente)`,
      String.raw`(qual|quais)\b[^.?!]{0,30}\b(melhor|pior|mais fort\w*|mais frac\w*)`,
      String.raw`(melhor|pior) (pra|para|ate) (a |o )?(pior|melhor)`,
      String.raw`(apont|identific|marc|sublinh|grif|destac|list|mostr|encontr|ach|resum)\w* (os |as |todos os |o que )?(\w+ )?(erros?|falhas?|problemas?|desvios?|esta errado)`,
      String.raw`erros?|plagi\w*|copiou|copiaram`,
      String.raw`aplic\w* (a |essa |esta |minha |sua )?rubrica`,
      String.raw`(qual|em que|que) (o )?nivel`,
      String.raw`faz sentido|atende (a|à) proposta|(acertou|errou|acertaram|erraram|entendeu|entenderam)|(usou|usaram|escreveu|escreveram) bem|(ficou|esta|ta) faltando`,
      String.raw`melhor(a|e|ar|ando|aria|em)|reescrev\w*|revis\w*|devolutiv\w*|feedbacks?|parecer\w*|julg\w*|opin\w*`,
    ].join('|') +
    String.raw`)\b`,
)

/** O que é texto escrito: resposta, texto, parágrafo, redação, trabalho, produção, e as partes dele. */
const TEXTO = String.raw`(respostas?|textos?|textinhos?|paragrafos?|redac\w+|trabalhos?|producao|producoes|dissertac\w+|composic\w+|relatorios?|resumos?|resenhas?|argumentos?|conclus\w+|introduc\w+|teses?|trechos?|frases?)`
/** O que o aluno produz e não é só texto: prova, atividade, exercício, questão, tarefa. Só conta com a marca de que é de um aluno. */
const TRABALHO = String.raw`(${TEXTO}|provas?|atividades?|exercicios?|questao|questoes|tarefas?|licao|licoes|cadernos?)`
/** A marca forte de que o trabalho é de um aluno: "do aluno", "da turma", "dela", "que o Caio escreveu", "escritos por alunos". */
const DE_ALUNO = new RegExp(
  [
    String.raw`\b${TRABALHO}\b[^.?!]{0,40}\bd(e|[oa]s?) (meus? |minhas? |um |uma |cada |algum |alguns |algumas )?(alun\w+|estudante\w*|menin\w+|garot\w+|crianca\w*|turma)\b`,
    String.raw`\b(alun\w+|estudante\w*)\b[^.?!]{0,40}\b(escrev\w+|respond\w+|redig\w+|entreg\w+|fez|fizeram|produziu|produziram|mandou|mandaram)\b`,
    String.raw`\bescrit\w* (por|pel[oa]s?) (\w+ )?(alun\w+|estudante\w*)\b`,
    String.raw`\b${TRABALHO} (\w+ ){0,2}del[ea]s?\b`,
    String.raw`\b${TRABALHO}\b[^.?!]{0,20}\bque (?!eu |voce |vc |tu |nos |a gente |a ia |o assistente )(o |a |os |as |um |uma |meu |minha )?\w+ (\w+ ){0,2}(escreveu|escreveram|fez|fizeram|respondeu|responderam|entregou|entregaram|produziu|mandou|redigiu)\b`,
    String.raw`\b(devolver|entregar|mandar) (pro|pra|para o|para a|ao|a) (alun\w+|estudante\w*)\b`,
  ].join('|'),
)
/** O que começa com maiúscula e não é nome de pessoa: disciplina, prova, sigla que a escola usa. */
const NAO_E_PESSOA = new Set('Quimica Fisica Matematica Biologia Historia Geografia Portugues Ingles Espanhol Artes Filosofia Sociologia Ciencias Enem Saeb Bncc Turmma Brasil Assistente Tutor Ninguem Alguem Quem Metade Ela Ele Eles Elas Todos Todas Tudo Nada Cada Qual Quais Alguns Algumas Varios Muitos Poucos Nenhum Nenhuma Isso Isto Voce Nos Eu'.split(' '))
/** Uma pessoa pelo nome: "a Ana", "o Pedro", "do Lucas", "da Maria", "pro Davi". */
const PESSOA_PELO_NOME = /\b(?:o|a|do|da|pro|pra|que o|que a|e o|e a)\s+([A-Z][a-z]{2,})\b/g
/** Uma pessoa que faz o que um aluno faz, no começo da frase: "Bianca usou bem os conectivos?", "Davi acertou?". */
const PESSOA_QUE_FEZ = /(?:^|[.?!:;]\s*)([A-Z][a-z]{2,})\s+(?:(?:nao|ja|tambem|bem|so|ainda|mal|nunca)\s+){0,2}(?:usou|escreveu|acertou|errou|fez|entendeu|respondeu|argumentou|desenvolveu|redigiu|entregou|copiou|compreendeu|dominou|explicou|resolveu)\b/g
function citaPessoaPeloNome(mensagem: string): boolean {
  const semAcentos = semAcento(mensagem)
  return [...semAcentos.matchAll(PESSOA_PELO_NOME), ...semAcentos.matchAll(PESSOA_QUE_FEZ)].some((achado) => !NAO_E_PESSOA.has(achado[1] ?? ''))
}
/**
 * De quem é o texto, dito com o nome: "o texto da Ana", "a resposta do Enzo", "o que a Bia escreveu". É a pessoa **com** a marca de
 * produção de aluno, e não só um nome com maiúscula depois de "a" ou "o" ("a Revolução Francesa", "o Sistema Internacional"):
 * é o que liga a chave da saída (`conversaTrazTextoDeAluno`).
 */
const DONO_DO_TEXTO =
  /\b(?:text\w+|redac\w+|respost\w+|trabalh\w+|paragraf\w+|producao|producoes|resumo|tese|prova|atividade|dissertacao)\s+(?:d[oa]|de)\s+([A-Z][a-z]{2,})\b|\b(?:o|a)\s+([A-Z][a-z]{2,})\s+(?:escreveu|respondeu|entregou|redigiu|mandou|produziu|colou)\b/g
/** A mensagem fala de uma parte do que se escreve: as palavras de `TEXTO` e o que se avalia nele (conectivo, vírgula, coesão…). */
const PARTE_DE_TEXTO = new RegExp(String.raw`\b${TEXTO}\b|\b(conectivos?|ortografia|pontuacao|concordancia|vocabulario|repertorio|coesao|coerencia|argumentacao|acentuacao|virgulas?)\b`, 'i')
/**
 * "Bianca usou bem os conectivos?" é a pessoa que faz o que um aluno faz **e** fala de uma parte de texto; "Lavoisier usou uma
 * balança" é assunto. Só o dono dito com a marca de produção escrita ("o texto da Ana", "a Bia escreveu") liga sem a parte de texto.
 */
function pessoaDonaDoTexto(mensagem: string): boolean {
  const semAcentos = semAcento(mensagem)
  const ehPessoa = (achado: RegExpMatchArray): boolean => !NAO_E_PESSOA.has(achado[1] ?? achado[2] ?? '')
  if ([...semAcentos.matchAll(DONO_DO_TEXTO)].some(ehPessoa)) return true
  return PARTE_DE_TEXTO.test(semAcentos) && [...semAcentos.matchAll(PESSOA_QUE_FEZ)].some(ehPessoa)
}
/** Redação e prova discursiva são, por natureza, texto de aluno. */
const REDACAO_OU_DISCURSIVA = /\b(redac\w+|discursiv\w+|dissertat\w+|producao textual|producoes textuais)\b/
/** A marca fraca: o texto está aqui, apontado ou colado ("essa resposta", "estes três parágrafos", "o texto abaixo"). */
const TEXTO_APONTADO = new RegExp(
  [
    String.raw`\b(ess[ea]s?|est[ea]s?|ness[ea]s?|nest[ea]s?|dess[ea]s?|dest[ea]s?) (\w+ )?${TEXTO}\b`,
    String.raw`\b${TEXTO}\b[^.?!]{0,20}\b(abaixo|a seguir|seguintes?|colad\w+|em anexo|anexad\w+|aqui)\b`,
    String.raw`\b(isso|isto|disso|disto) aqui\b`,
  ].join('|'),
)
const RESPOSTA = /\brespostas?\b/
/** O que é do material do professor: o gabarito, a alternativa, o enunciado, a explicação da questão. */
const DO_MATERIAL = /\b(gabarito\w*|alternativas?|enunciados?|explicac\w+ da questao)\b/
/** O que é do próprio professor, ou do Assistente: "que eu gerei", "que você montou", "meu plano", "minha atividade". */
const DO_PROPRIO_PROFESSOR =
  /\bque (eu|voce|vc|a gente|nos) (\w+ )?(gerei|gerou|geramos|fiz|fez|fizemos|escrevi|escreveu|montei|montou|montamos|criei|criou|elaborei|elaborou|preparei|preparou)\b|\b(meu|minha|meus|minhas) (plano|texto|enunciado|atividade|prova|questao|questoes|aula|material|rubrica|criterios?)\b/
/** Pedir a rubrica ou os critérios, **antes** da aplicação: é o que a D55 deixa (`docs/decisoes.md`). */
const PEDE_RUBRICA = /\b(mont|cri|faz|fac|elabor|ger|prepar|quero|preciso|sugir|suger|escrev|defin)\w* (\w+ ){0,3}(rubricas?|criterios?|barema|grade de correcao)\b/
/** Opinião pedida sobre o que veio junto, ou antes: "o que achou?", "e aí, ficou bom?", "e esse?". */
const PEDE_OPINIAO =
  /\b(o que (voce |vc |tu )?(acha|achou)|que (voce |vc )?(acha|achou)|d[ae]r? uma (olhada|olhadinha|lida)|(esta|ta|ficou|e) (bom|boa|certo|certa|ok|legal|melhor|pior)|olha (isso|isto|so|aqui)|e (ai|esse|essa|este|esta|isso|agora)|segue|corrig\w*|corrij\w*|avali\w*|analis\w*|coment\w*|confer\w*|chec\w*|apont\w* (os )?erros)\b/

const ASPAS_LONGAS = /[“"][^”"]{60,}[”"]/u
const CARACTERES_DE_TEXTO_COLADO = 160
const CARACTERES_DEPOIS_DOS_DOIS_PONTOS = 80

/** A mensagem traz um bloco de texto colado: aspas compridas, várias linhas, dois-pontos seguidos de um parágrafo, ou é longa. */
function trazTextoColado(mensagem: string): boolean {
  const cru = mensagem.trim()
  if (ASPAS_LONGAS.test(cru) || cru.length >= CARACTERES_DE_TEXTO_COLADO) return true
  if (cru.includes('\n') && cru.length >= CARACTERES_DE_TEXTO_COLADO / 2) return true
  const depoisDosDoisPontos = cru.slice(cru.indexOf(':') + 1)
  return cru.includes(':') && depoisDosDoisPontos.trim().length >= CARACTERES_DEPOIS_DOS_DOIS_PONTOS
}

/**
 * Uma mensagem só: o professor está pedindo que a IA **julgue texto ou resposta de aluno**, ou que **dê nota, conceito
 * ou pontuação**? Erra para o lado de recusar.
 *
 * Recusa:
 * - pedido de nota, conceito ou pontuação, ou de dizer se passa, sozinho ("nota?", "ele tira quanto?");
 * - pedido de escrever devolutiva, comentário ou parecer;
 * - julgamento (olhar, conferir, classificar, ranquear, apontar ou marcar erro, aplicar a rubrica, dizer se está bom,
 *   melhorar, reescrever) sobre redação ou discursiva; sobre trabalho **de aluno** ("do aluno", "dela", "da turma"); sobre
 *   o que **uma pessoa pelo nome** escreveu ("o texto do Lucas", "a Ana acertou?"); sobre texto **apontado** ("essa
 *   resposta", "estes três parágrafos"); ou sobre uma resposta;
 * - texto colado com marca de aluno, de redação ou de nome, com ou sem verbo ("segue o texto do Lucas: …");
 * - texto colado com qualquer pedido de opinião ("… o que achou?", "tem erro aqui? …").
 *
 * Passa, porque é trabalho do professor sobre o material dele: "corrige a atividade que eu gerei", "melhora o enunciado
 * da questão 3", "confere o gabarito", e o pedido de rubrica e de critérios, antes da aplicação.
 */
export function pedeJulgamentoDeTextoDeAluno(mensagem: string): boolean {
  const texto = paraARegra(mensagem)
  if (PEDE_NOTA.test(texto) || SO_A_NOTA.test(texto.trim()) || ESCREVE_DEVOLUTIVA.test(texto)) return true
  const colado = trazTextoColado(mensagem)
  const julga = PEDE_JULGAMENTO.test(texto)
  const deAluno = DE_ALUNO.test(texto) || citaPessoaPeloNome(mensagem)
  const apontado = TEXTO_APONTADO.test(texto)
  // A rubrica e os critérios pedidos antes da aplicação passam; aplicados a um texto, não.
  if (PEDE_RUBRICA.test(texto) && !colado && !deAluno && !apontado && !/\baplic\w*/.test(texto)) return false
  if (julga && (REDACAO_OU_DISCURSIVA.test(texto) || deAluno)) return true
  if (colado && (deAluno || REDACAO_OU_DISCURSIVA.test(texto) || julga || PEDE_OPINIAO.test(texto))) return true
  // Daqui para baixo, a marca é fraca: o que o próprio professor diz que é dele, ou do material dele, não é texto de aluno.
  if (DO_PROPRIO_PROFESSOR.test(texto) || DO_MATERIAL.test(texto)) return false
  return julga && (apontado || RESPOSTA.test(texto))
}

/** Os turnos da conversa, como a tarefa os recebe. */
type Turno = EntradaDoAssistente['turnosAnteriores'][number]

/**
 * Uma mensagem do professor traz texto de aluno: colado, de aluno, de uma pessoa **dona do texto** ("o texto da Ana", "Bianca usou
 * bem…"), ou apontado. **Redação e discursiva sozinhas não ligam a chave**, porque nomear o gênero ("rubrica pra redação do 9º
 * ano") não põe texto nenhum na conversa; **nem um nome sozinho**, porque "a Revolução Francesa" não é aluno. Na entrada, essas
 * marcas continuam valendo junto com o pedido de julgamento (`pedeJulgamentoDeTextoDeAluno`).
 */
function mensagemTrazTextoDeAluno(mensagem: string): boolean {
  const texto = paraARegra(mensagem)
  return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto)
}

/** "Para esse tipo de texto": o demonstrativo, "tipo de" e uma palavra de texto apontam para o que veio antes (decisão 12 do `ouro`). */
const APONTA_PARA_O_TIPO_DE_TEXTO = new RegExp(String.raw`\b[dn]?(ess[ea]|est[ea])s? tipos? de ${TEXTO}\b`)

/**
 * A conversa traz texto de aluno: na mensagem de agora, ou em qualquer turno anterior **do professor**. É a chave da
 * conferência da saída (`julgaTextoDeAluno`): a saída da D55 só é julgamento quando há texto de aluno a julgar.
 */
export function conversaTrazTextoDeAluno(mensagem: string, turnosAnteriores: readonly Turno[]): boolean {
  const doProfessor = turnosAnteriores.filter((turno) => turno.autor === 'professor')
  // "Esse tipo de texto", havendo turno anterior do professor, aponta para o que ele trouxe: é o texto de aluno da conversa.
  if (doProfessor.length > 0 && APONTA_PARA_O_TIPO_DE_TEXTO.test(paraARegra(mensagem))) return true
  return mensagemTrazTextoDeAluno(mensagem) || doProfessor.some((turno) => mensagemTrazTextoDeAluno(turno.texto))
}

/** A mensagem curta que pede opinião, ou nota, sobre o que veio antes: "e aí, ficou bom?", "e esse?", "dá nota pra cada uma". */
function pedeOpiniaoSobreOAnterior(mensagem: string): boolean {
  const texto = paraARegra(mensagem)
  // O pedido que diz sobre o que é, e é do material do professor, não se refere ao texto colado antes.
  if (DO_PROPRIO_PROFESSOR.test(texto) || DO_MATERIAL.test(texto) || PEDE_RUBRICA.test(texto)) return false
  return PEDE_OPINIAO.test(texto) || PEDE_JULGAMENTO.test(texto) || PEDE_NOTA.test(texto) || SO_A_NOTA.test(texto.trim())
}

/**
 * Mexer no que veio antes, com a referência a ele: "deixa isso mais curto", "reescreve ele", "resume esse texto". A referência solta ("isso", "ele") ou o
 * demonstrativo seguido de uma palavra de `TEXTO`; "simplifica esse plano" e "torna essa atividade mais simples" falam do material do professor.
 */
const MEXE_NO_TEXTO_ANTERIOR = new RegExp(
  String.raw`\b(?:deix\w+|torn\w+|encurt\w+|resum\w+|simplific\w+|enxug\w+|reescrev\w+|reformul\w+) (?:\w+ ){0,3}(?:isso|isto|ele|ela)\b|\b(?:deix\w+|torn\w+|encurt\w+|resum\w+|simplific\w+|enxug\w+|reescrev\w+|reformul\w+) (?:\w+ ){0,3}(?:ess[ea]s?|est[ea]s?) (?:\w+ )?${TEXTO}\b`,
)

/**
 * "deixa isso mais curto" depois de um texto colado é mexer no texto do aluno (D55), e a regra do README do `ouro` é a
 * referência: "deixa o enunciado da questão 1 mais curto" fala da atividade do professor, e passa.
 */
function pedeMexerNoTextoAnterior(mensagem: string): boolean {
  const texto = paraARegra(mensagem)
  if (DO_PROPRIO_PROFESSOR.test(texto) || DO_MATERIAL.test(texto)) return false
  return MEXE_NO_TEXTO_ANTERIOR.test(texto)
}

/**
 * Rubrica ou critérios pedidos **depois** de um texto de aluno colado saem sob medida para ele, e isso é pré-correção (D55;
 * decisão 12 do `ouro`), mesmo com "antes de eu aplicar" e mesmo com "para esse tipo de texto". A rubrica de antes da
 * aplicação é a pedida sem texto de aluno antes na conversa.
 */
function pedeRubricaSobreOAnterior(mensagem: string): boolean {
  return PEDE_RUBRICA.test(paraARegra(mensagem))
}

/**
 * A conversa inteira, e não só a frase (D55; regra 70, item 2a): recusa a mensagem que a regra recusaria, e a que pede
 * opinião, ou nota, depois de um turno do professor com texto colado — colar numa mensagem e perguntar "e aí, ficou
 * bom?" na seguinte é a forma mais comum de pedir pré-correção. Em "só conversar", a resposta atende o último pedido do
 * professor, e por isso ele também passa pela regra.
 *
 * **O que a regra ainda não pega**, dito com franqueza: pedido escrito de um jeito que estas listas não conhecem
 * ("o que a turma entendeu disso?", ironia, abreviação nova); texto de aluno curto colado sem marca nenhuma e sem pedido;
 * julgamento sobre uma pessoa citada só pelo primeiro nome com um verbo que a lista de `PESSOA_QUE_FEZ` não tem; e o
 * que vier por um turno de mais de oito mensagens atrás. Esses seguem para o modelo, sob o prompt, que proíbe julgar
 * texto de aluno, e sob a conferência da saída, que recusa nota, conceito e pontuação. Por isso a tarefa declara
 * `levaTextoDeAluno`. A D55 não se resolve só com lista de palavras.
 */
export function conversaPedeJulgamentoDeTextoDeAluno(mensagem: string, turnosAnteriores: readonly Turno[], semProposta = false): boolean {
  if (pedeJulgamentoDeTextoDeAluno(mensagem)) return true
  const doProfessor = turnosAnteriores.filter((turno) => turno.autor === 'professor').map((turno) => turno.texto)
  if (semProposta && pedeJulgamentoDeTextoDeAluno(doProfessor.at(-1) ?? '')) return true
  if (!doProfessor.some(trazTextoColado)) return false
  return pedeOpiniaoSobreOAnterior(mensagem) || pedeRubricaSobreOAnterior(mensagem) || pedeMexerNoTextoAnterior(mensagem)
}

/**
 * Os turnos anteriores que podem ir ao modelo: sai o turno do professor que a regra recusaria, e sai o texto colado,
 * que pode ser de aluno mesmo sem pedido nenhum junto. O pedido de agora vai inteiro; o contexto perde só isso.
 */
export function turnosQuePodemIrAoModelo(turnosAnteriores: readonly Turno[]): Turno[] {
  return turnosAnteriores.filter((turno) => turno.autor !== 'professor' || !(pedeJulgamentoDeTextoDeAluno(turno.texto) || trazTextoColado(turno.texto)))
}

/** Número de nota, em algarismo ou por extenso. */
const NUMERO_DE_NOTA = String.raw`(\d{1,3}([.,]\d{1,2})?|zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|cem)( e meio)?`
/** Onde o número é a nota: acaba a frase, ou vem "pontos", "de 10", "/10". "Dou 3 exemplos" não. */
const FIM_DA_NOTA = String.raw`(?=\s*([.,;!?)]|$|\n|e meio|pontos?\b|de (10|dez)\b|em (10|dez)\b|\/|no maximo|para (ess|est|o text|a redac|a respost)|pra (ess|est)))`
const SAIDA_COM_NOTA: readonly RegExp[] = [
  /\bnotas?\b[^.!?\n]{0,30}\d/,
  new RegExp(String.raw`\bnota( final)?\b[:\s]+(seria |e |de )?${NUMERO_DE_NOTA}\b`),
  /\b\d{1,3}([.,]\d{1,2})?\s*\/\s*(10|100)\b/,
  /\b\d{1,2}([.,]\d{1,2})? (de|em|sobre) (10|dez)\b(?! (questoes|itens|exercicios|alunos|perguntas|minutos|aulas))/,
  /\bpontuac\w+\b[^.!?\n]{0,30}\d/,
  /\b\d{1,3}([.,]\d)? pontos?\b(?! (importantes?|principais|centrais|chave|de atencao|fortes|fracos))/,
  /\b(daria|dou|atribuo|atribuiria|merece|mereceria|ficaria com|tiraria|vale|valeria)\b[^.!?\n]{0,25}\b(nota|conceito)\b/,
  new RegExp(String.raw`\b(daria|dou|atribuo|atribuiria|merece|mereceria|tira|tiraria|tirou|ficaria com|fica com|vale|valeria)\b\s+(um |uma |uns |umas |a |o |cerca de |no maximo |nota )?${NUMERO_DE_NOTA}\b${FIM_DA_NOTA}`),
  /\bconceito\b( final| sugerido| atribuido| proposto)?[:\s]+["“']?(insuficiente|regular|bom|muito bom|otimo|excelente|satisfatorio|insatisfatorio)\b/,
]
/** "Conceito A", "merece um B", "daria um C": a letra maiúscula sozinha, para não confundir com "o conceito a ser trabalhado". */
const SAIDA_COM_CONCEITO_EM_LETRA = /\b([Cc]onceito\b[:\s]+(final\s+)?|([Dd]aria|[Dd]ou|[Aa]tribuo|[Aa]tribuiria|[Mm]erece|[Mm]ereceria|[Tt]iraria|[Ff]icaria com)\s+(um|uma|o)?\s*)["“'‘]?[A-E][+-]?(?![\p{L}-])/u

/**
 * A resposta atribui **nota, conceito ou pontuação**? É a conferência da saída (D55; regra 70, item 2a): o que o
 * modelo disser com nota não é gravado nem chega à tela, qualquer que tenha sido o pedido. A IA desta fatia não dá
 * nota a nada, então a conferência não precisa saber a quê a nota se refere.
 */
export function atribuiNotaOuConceito(resposta: string): boolean {
  const texto = paraARegra(resposta)
  return SAIDA_COM_NOTA.some((padrao) => padrao.test(texto)) || SAIDA_COM_CONCEITO_EM_LETRA.test(semAcento(resposta))
}

const PROBLEMA_DA_NOTA =
  'A resposta atribui nota, conceito ou pontuação. Você não avalia texto nem resposta de aluno: reescreva sem nota, sem conceito e sem pontuação, dizendo que a correção é do professor.'

/** A saída fala de texto concreto: "o texto", "a redação", "o parágrafo 2", "a tese", "o aluno", ou "o que ela escreveu". */
const SAIDA_FALA_DO_TEXTO = new RegExp(
  String.raw`\b(textos?|textinhos?|redac\w+|respostas?|trabalhos?|producao|producoes|paragrafos?|introducao|conclusao|tese|argument\w+|desenvolvimento|dissertac\w+|composic\w+|resumos?|resenhas?|relatorios?|escrita|ortografia|conectivos?|vocabulario|repertorio|alun[oa]s?|estudantes?|frases?|trechos?|caligrafia)\b|\bo que (el[ea]|\w+) (escreveu|respondeu|entregou|redigiu)\b|\b[a-z]-\d{1,3}\b|\b(o|a) (primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|ultim[oa])\b`,
)

/** A frase que abre com a pessoa e um verbo de quem escreve ou julga: "A Bia ficou…", "O Davi precisa…" (e não "A Revolução Francesa mostrou…"). */
const PESSOA_NA_SAIDA =
  /(?:^|[.!?\n;:]\s*)(?:[AO]\s+)?([A-Z][a-z]{2,})\b(?!\s+[A-Z])\s+(?:\w+\s+){0,2}(?:ficou|leu|apresentou|demonstrou|mostrou|precisa|deveria|poderia|conseguiu|soube|tirou|trouxe|citou|mencionou|entendeu|entenderam|compreendeu|compreenderam|dominou|dominaram|aprendeu|aprenderam|assimilou|assimilaram)\b/g
/** Quem o texto nomeia: "o texto da Bia", "o que a Bia escreveu", ou a frase que abre com a pessoa e um verbo dela. */
function saidaCitaPessoa(frase: string): boolean {
  return pessoaDonaDoTexto(frase) || [...semAcento(frase).matchAll(PESSOA_NA_SAIDA)].some((achado) => !NAO_E_PESSOA.has(achado[1] ?? ''))
}

/**
 * Cada jeito de julgar o que está escrito, **na mesma frase** em que a saída fala do texto (D55; regra 70, item 2a). Um por
 * linha, para a mutação tirar um e o teste dizer qual jeito deixou de ser barrado. As listas de palavras são largas de
 * propósito, porque a regra erra para o lado de barrar; o que protege a rubrica e o lote é a frase precisar falar do
 * texto, e a conversa precisar trazer texto de aluno.
 */
const SAIDA_JULGA_O_TEXTO: readonly RegExp[] = [
  // O texto é bom, fraco, confuso, claro, bem escrito, original…
  /\b(bom|boa|bons|boas|otim\w+|excelente\w*|ruim|ruins|pessim\w+|fraco|fraca|fracos|fracas|forte|fortes|confus\w+|vago|vaga|vagos|vagas|superficial\w*|raso|rasa|repetitiv\w+|incoerent\w+|coerent\w+|incoes\w+|coeso|coesa|claro|clara|claros|claras|obscur\w+|insuficiente\w*|adequad\w+|inadequad\w+|satisfatori\w+|insatisfatori\w+|criativ\w+|original|originais|mediocre|razoavel|razoaveis|(bem|mal) (escrit\w+|argumentad\w+|desenvolvid\w+|estruturad\w+|organizad\w+|construid\w+|redigid\w+|fundamentad\w+))\b/,
  // Parabéns, gostei, bom trabalho, no caminho certo, esforço, promissor
  /\b(parabens|gostei|caminho certo|bom trabalho|belo trabalho|bonito|capricho\w*|esforc\w+|promissor\w*|impressionante|surpreendente|notavel|destacad\w+|merece (elogio|destaque|atencao))\b/,
  // O texto tem erro, falha, equívoco, foge do tema, confunde um conceito, está incompleto…
  /\b(erro|erros|errou|errad[oa]s?|incorret\w+|equivoc\w+|falha|falhas|falhou|problemas?|inconsistenc\w+|contradi\w+|confund\w+|foge|fogem|fugindo|fugiu|fugiram|fuga|desvia\w*|plagi\w+|ambigu\w+|impreciso\w*|imprecisa|incomplet\w+|copiou)\b/,
  // Não decorre, não procede, contradiz, não tem lógica, o correto é
  /\bnao (decorre|se sustenta|se segue|procede|condiz|corresponde|bate|fecha)\b|\b(contradiz|sem sentido)\b|\bnao tem (relacao|sentido|logica)\b|\bo (correto|certo) (e|seria)\b/,
  // Faltou coesão, falta uma conclusão, sem tese, faltou acento…
  /\b(falt(a|ou|am|aram|ando)|sem|ausencia de)\s+(\w+\s+){0,2}(coesao|coerencia|clareza|argument\w*|exemplos?|conclusao|conclusoes|introducao|tese|desenvolvimento|aprofundamento|conectivos?|pontuacao|paragrafacao|repertorio|detalhes?|precisao|organizacao|fundamentacao|acentos?|acentuacao|virgulas?|crase|concordancia|maiuscula|regencia|citar|mencionar|explicar|justificar)\b/,
  // Acertou, errou, está correta, está errada
  /\b(acertou|acertaram|acerto|acertos)\b|\b(esta|estao|ficou|ficaram|foi|e|sao) (totalmente |parcialmente |bem |muito )?(corret[oa]s?|cert[oa]s?)\b/,
  // Não citou, não explicou, esqueceu, omitiu, trocou um conceito pelo outro, em vez de
  /\b(nao|nunca) (citou|mencionou|explicou|justificou|desenvolveu|apresentou|respondeu|conseguiu|soube|mostrou|fundamentou|relacionou)\b|\b(esqueceu|omitiu|deixou de|trocou|inverteu|misturou|ignorou)\b|\b(em vez de|no lugar de|ao inves de)\b/,
  // Demonstra domínio, compreensão, dificuldade, clareza, evolução…
  /\b(demonstr\w+|mostr\w+|revel\w+|evidenci\w+|apresent\w+|possui|exibe|tem|com) (\w+ ){0,3}(dominio|compreensao|entendimento|dificuldades?|clareza|coesao|coerencia|criatividade|maturidade|profundidade|progresso|evolucao|capacidade|autonomia|fluencia|argumentacao)\b/,
  // É melhor que, é mais forte que, supera, fica acima das outras, se destaca
  /\b(melhor|pior|superior|inferior|mais \w+|menos \w+) (do )?(que|do que)\b|\b(o|a) (melhor|pior) d[aeo]s?\b|\b(acima|abaixo|aquem) d[aeo]s? (outr\w+|demais|media|resto|esperad\w+)\b|\b(o|a|os|as) (melhor|pior|melhores|piores) (introduc(ao|oes)|conclus(ao|oes)|teses?|argumentos?|paragrafos?|desenvolvimentos?|textos?|redac(ao|oes))\b|\b(se destaca|destaca-se|supera|superou|perde para|ganha d[ea]|entre (as|os) (melhores|piores))\b|\b(primeiro|segundo|terceiro|ultimo) lugar\b/,
  // Mais forte, menos completo, mais bem escrito
  /\b(mais|menos) (forte|fraco|fraca|fortes|fracos|fracas|completo|completa|claro|clara|coerente|criativo|criativa|bem \w+|desenvolvid\w+|elaborad\w+|consistente|convincente|organizad\w+|detalhad\w+)\b/,
  // O texto é longo demais, o parágrafo está extenso demais: o excesso dito do texto
  /\b(extens\w+|long\w+|curt\w+|grande|grandes|pequen\w+|breve|breves|compri\w+|detalhad\w+|resumid\w+|enxut\w+|prolix\w+|cansativ\w+|repetitiv\w+) demais\b/,
  // Reescreva, acrescente, troque: o que mudar no texto, dito em imperativo
  /^[\s\-*•\d.)]*(reescrev\w*|reformul\w*|refaca|troque|substitua|acrescente|adicione|aprofunde|detalhe|desenvolva|explicite|cite|mencione|revise|ajuste|corrija|inclua)\b/,
  // Sugiro reescrever, ele deveria trocar, para melhorar acrescente
  /\b(sugiro|recomendo|sugestao|pode|podem|precisa|precisam|poderia|poderiam|deveria|deveriam|para melhorar|conviria|seria (bom|melhor|interessante|ideal)|tente|tentar)\b[^.!?\n]{0,60}\b(reescrev\w*|reformul\w*|refaz\w*|refaca|reorganiz\w*|reelabor\w*|trocar|troque|substitu\w*|acrescent\w*|adicion\w*|melhor(ar|e)|revis(e|ar)|ajust(e|ar)|aprofund\w*|detalh(e|ar)|desenvolv(a|er)|explicit\w*|cit(e|ar)|mencion(e|ar))\b/,
  // Uma versão melhor seria, reescrevi assim, ficaria melhor, em vez de X use Y
  /\b(versao|reescrita|reformulacao|alternativa) (melhorada|reescrita|sugerida|corrigida|ajustada|possivel|melhor)\b|\b(reescrevi|reformulei|refiz|corrigi|ajustei|melhorei)\b|\b(ficaria melhor|melhoraria|seria melhor|para (ficar melhor|reforcar|fortalecer|dar mais forca))\b|\b(use|usar|utilize|utilizar|escreva|escrever|comece|comecar|termine|finalize) [^.!?\n]{0,40}\b(conectivos?|termo|palavra|expressao|verbo|dados?)\b/,
]

/** Está no nível 3, se enquadra no nível avançado, atende parcialmente: afirmar o nível que um texto tem na rubrica. */
const SAIDA_AFIRMA_NIVEL: readonly RegExp[] = [
  /\b(esta|estao|ficou|ficaram|fica|enquadra\w*|encontra\w*|classific\w+|situa\w*|chegou|alcancou|atingiu|atinge|alcanca|corresponde|equivale)\b[^.!?\n]{0,30}\bnivel\b/,
  /\b(classifico|classifiquei|enquadro|enquadrei|situo|situei|considero|avalio|avaliei|coloco|coloquei|marco|marquei)\b[^.!?\n]{0,40}\bnivel\b/,
  /\b(nao )?(atende|atendeu|atinge|atingiu|cumpre|cumpriu|satisfaz|satisfez)\b/,
  /\b(demonstrou|mostrou|apresentou|dominou|evidenciou|compreendeu) (\w+ ){0,3}(plenamente|parcialmente|totalmente|em parte|integralmente|insuficientemente)\b/,
  /\b(atende|atendeu|atinge|atingiu|alcanca|alcancou|cumpre|cumpriu) (plenamente|parcialmente|totalmente|em parte|integralmente|insuficientemente)\b|\b(parcialmente|plenamente|insuficientemente) (atendid\w+|alcancad\w+|atingid\w+)/,
]

/** O adjetivo de qualidade que se diz de um texto subentendido: "Está confuso", "Ficou excelente". */
const QUALIDADE_SEM_SUJEITO = String.raw`bom|boa|otim\w+|excelente|confus\w+|clar[oa]|convincente|superficial|vag[oa]|frac[oa]|forte|coes[oa]|coerente|incoerente|repetitiv\w+|prolix\w+|cansativ\w+|corret\w+|errad\w+|incomplet\w+|complet\w+|ruim|perfeit\w+|(?:bem |mal )?(?:escrit\w+|construid\w+|argumentad\w+|organizad\w+|desenvolvid\w+)`

/** O elogio que uma frase pode ser inteira: "Muito bom", "Parabéns", "É um bom começo"; vários, separados por vírgula. */
const ELOGIO = String.raw`muito bom|bom trabalho|parabens|(?:e )?(?:um )?bom comeco`

/** Sem frase que fale do texto: o juízo vale por si, porque a conversa já traz texto de aluno. */
const SAIDA_JULGA_SEM_APONTAR: readonly RegExp[] = [
  // Pontos fortes, pontos a melhorar, fragilidades
  /\bpontos? (fortes?|fracos?|a (melhorar|corrigir|revisar|ajustar)|de melhoria|positivos?|negativos?)\b|\bfortalezas?\b|\bfragilidades?\b/,
  // O que falta da norma: precisa de crase, falta de parágrafo de introdução
  /\bprecisa(m)? de (\w+ ){0,2}(virgulas?|acentos?|acentuacao|crase|ponto final|paragrafos?|conclus\w+|introduc\w+|conectivos?|revisao|tese)\b|\bfalta de (\w+ ){0,3}(conclus\w+|introduc\w+|tese|paragraf\w+|coesao|argument\w+)\b/,
  // Está confuso, ficou excelente: o juízo sem sujeito, com o texto subentendido
  new RegExp(String.raw`(?:^[\s\-*•]*|,\s*)(?:esta|estao|e|ficou|ficaram|parece|soa)\s+(?:(?:muito|bem|pouco|um pouco|bastante|meio|tao)\s+)*(?:${QUALIDADE_SEM_SUJEITO})\b(?!\s+que\b)(?!\s+\w+(?:ar|er|ir)\b)`),
  // Muito bom, parabéns, bom trabalho, gostei: o elogio sozinho
  new RegExp(String.raw`^[\s\-*•]*(?:${ELOGIO})(?:\s*,\s*(?:${ELOGIO}))*\s*$|\bparabens (?:pelo|pela|por)\b|\bgostei\b`),
  // Do mais forte ao mais fraco, ranking, os melhores textos
  /\bdo (\w+ )?(mais|melhor) \w+ ao (\w+ )?(mais|pior) \w+|\b(melhor|mais forte|mais fraco|pior) (ao|para o|pro|ate o) (pior|melhor|mais fraco|mais forte)\b|\bem ordem (decrescente |crescente )?de (qualidade|desempenho|nivel|merito|forca)\b|\branking\b|\branque\w+|\b(os|as|o|a) (melhor|melhores|pior|piores) (text\w+|redac\w+|trabalh\w+|respost\w+|producao|producoes|paragraf\w+)\b/,
  // Errou, está errada, incorreto, equívoco, erros de concordância, acertou
  /\b(errou|errad[oa]s?|incorret\w+|equivoc\w+|acertou|acertaram)\b|\berros? (de|na|no|em|d[ao]) \w+/,
  // Uma versão melhor do trecho seria: “…”, a frase do aluno já refeita
  /\b(versao|reescrita|reformulacao|alternativa)\b[^.!?\n:]{0,30}\b(melhor|melhorad\w+|mais \w+|aprimorad\w+|revisad\w+|corrigid\w+)\b[^.!?\n:]{0,20}:/,
  // Faltou a conclusão, esqueceu de citar, confundiu um conceito, trocou: o defeito dito sem sujeito
  /\b(falt(a|ou|am|aram|ando)|ausencia de)\s+(\w+\s+){0,2}(coesao|coerencia|clareza|argument\w*|exemplos?|conclusao|conclusoes|introducao|tese|desenvolvimento|aprofundamento|conectivos?|pontuacao|paragrafacao|repertorio|acentos?|acentuacao|virgulas?|crase|concordancia|maiuscula|regencia)\b|\b(confundiu|confundiram|esqueceu|omitiu|deixou de|inverteu|misturou)\b|\bnao (decorre|se sustenta|se segue|procede|condiz)\b/,
  // Na verdade é, o correto é, é 58,5 e não 60, mas o gabarito é: a correção do que o aluno disse
  /\b(na verdade|o (correto|certo|gabarito) (e|seria)|mas (o|a) (correto|certo|correta|certa|gabarito|resposta correta)|deveria ser|deveria ter sido)\b|\be nao \d/,
  // Coesão: nível avançado
  /\b(coesao|coerencia|tese|argumentacao|ortografia|gramatica|vocabulario|repertorio|organizacao|clareza|intervencao|norma culta|paragrafacao|pontuacao)\b[^.!?\n]{0,25}\b(nivel|conceito)\b/,
]

/** A frase abre com o descritor de um critério ("Nível 3: tese clara"): é rubrica, de antes da aplicação, e não juízo. */
const DESCRITOR_DE_CRITERIO = /^[\s\-*•\d.)]*(nivel|descritor|indicador|dimensao|eixo)\b/
/** "Se o texto…", "textos que…", "o texto deve apresentar…": é o critério dito em geral, e não o texto de alguém. */
const CRITERIO_EM_GERAL = /^[\s\-*•\d.)]*(se|quando|caso|sempre que)\b|^[\s\-*•\d.)]*(textos?|respostas?|alunos?|redacoes) que\b|\bdev(e|em|erao) (apresentar|conter|ter|trazer|demonstrar|mostrar|incluir|cumprir|atender|desenvolver)\b|\bespera-se\b/
/** "…fica no nível 2 quando não tem tese": o nível dito como condição é o descritor da rubrica, e não o nível de um texto. */
const NIVEL_COMO_CONDICAO = /\b(quando|sempre que|caso|desde que|a menos que|dependendo|se (o|a|os|as|ele|ela|nao))\b/
/** A frase fala do critério, da rubrica ou do barema: é a rubrica sendo escrita, e o que ela diz do texto é descritor. */
const FALA_DO_CRITERIO = /\b(criterios?|rubricas?|descritores?|baremas?|indicadores?|dimensoes|eixos|competencias|quesitos|aspectos a (avaliar|observar)|matriz de correcao|escala|antes (da|de) (aplicar|aplicacao)|aplicacao)\b/
/** Critérios ou rubrica feitos para **aquele** texto, e não para o tipo de texto: "critérios para esse texto", "rubrica a partir do texto da Bia". */
const RUBRICA_SOB_MEDIDA = new RegExp(
  [
    String.raw`\b(criterios?|rubrica|barema|descritores?)\b[^.!?\n]{0,60}\b(ess[ea]|est[ea]|dess[ea]|dest[ea]|aquel[ea]|seu|sua|del[ea])s? (\w+ )?(text\w+|redac\w+|respost\w+|trabalh\w+|paragraf\w+|producao)\b`,
    String.raw`\b(criterios?|rubrica|barema|descritores?)\b[^.!?\n]{0,60}\b(a partir|com base|basead[oa]s?|tendo como base|considerando|sob medida|ajustad[oa]s?|pensad[oa]s?|montad[oa]s?|adaptad[oa]s?|personalizad[oa]s?|feit[oa]s?|criad[oa]s?|elaborad[oa]s?|para (ele|ela)|sobre o que)\b`,
    String.raw`\b(criterios?|rubrica|barema|descritores?)\b[^.!?\n]{0,60}\bo que (el[ea]|o aluno|a aluna|\w+) (escreveu|respondeu|entregou|redigiu|colou)\b`,
  ].join('|'),
)
/** A rubrica nomeia de quem é o texto: "critérios para o texto da Bia". */
const RUBRICA_E_TEXTO_DE_PESSOA = /\b(criterios?|rubrica|barema|descritores?)\b[^.!?\n]{0,60}\b(text\w+|redac\w+|respost\w+|trabalh\w+|paragraf\w+|producao)\b/

function rubricaSobMedida(texto: string, frase: string): boolean {
  return RUBRICA_SOB_MEDIDA.test(texto) || (RUBRICA_E_TEXTO_DE_PESSOA.test(texto) && saidaCitaPessoa(frase))
}

/** A frase fala ao professor do que ele pode fazer ou decidir, e não do que o aluno escreveu: "você ajusta", "defina", "se quiser", "espera a sua aprovação". */
const SAIDA_AO_PROFESSOR = /^[\s\-*•\d.)]*(defina|escolha|decida|monte|pense|considere|combine|alinhe|registre|lembre|garanta|deixe)\b|\b(voce|vc|posso|podemos|vamos|vou|sugiro|recomendo|se quiser)\b/
/** A saída recusa julgar e devolve a correção ao professor: "não avalio", "a correção é sua". É a resposta que a D55 quer. */
const SAIDA_QUE_RECUSA = /\b(nao (avalio|corrijo|julgo|comento|posso (avaliar|corrigir|julgar|comentar))|correcao e (sua|do professor|da professora)|cabe (a|ao) (voce|professor|professora))\b/
/** O que se diz da rubrica: o texto, o aluno ou uma pessoa com o nível, o critério ou a pontuação dela. */
const SAIDA_DE_NIVEL_NA_RUBRICA = /\b(nivel|niveis|pontos?|conceito|faixa)\b/

/** O desempenho de quem escreveu, dito com verbo: "o aluno entendeu", "ele precisa praticar". */
const SAIDA_DESEMPENHO = /\b(entendeu|entenderam|compreendeu|compreenderam|dominou|dominaram|aprendeu|aprenderam|assimilou|assimilaram)\b|\bprecisa(m)? (de )?(praticar|estudar|treinar|reforcar|melhorar|rever|revisar|exercitar)\b/
/** O sujeito é uma pessoa: o aluno, o estudante, "ele", "ela", ou alguém pelo nome. */
const SAIDA_SUJEITO_PESSOA = /\b(alun[oa]s?|estudantes?|el[ea]s?)\b/

type Razao = 'sob_medida' | 'sem_apontar' | 'nivel' | 'julga' | 'desempenho'

/** Uma rubrica inteira (vários critérios ou níveis) é a rubrica de antes da aplicação: o que ela diz do "texto" é descritor. */
function ehRubricaInteira(frases: readonly string[]): boolean {
  const textos = frases.map(paraARegra)
  return textos.filter((texto) => DESCRITOR_DE_CRITERIO.test(texto) || /^[\s\-*•\d.)]*criterios?\b/.test(texto)).length >= 3 || textos.filter((texto) => FALA_DO_CRITERIO.test(texto)).length >= 4
}

function razaoNaFrase(frase: string, rubricaInteira: boolean): Razao | undefined {
  const texto = paraARegra(frase)
  if (rubricaSobMedida(texto, frase)) return 'sob_medida'
  if (rubricaInteira || CRITERIO_EM_GERAL.test(texto)) return undefined
  if (SAIDA_JULGA_SEM_APONTAR.some((padrao) => padrao.test(texto))) return 'sem_apontar'
  const fala = SAIDA_FALA_DO_TEXTO.test(texto) || saidaCitaPessoa(frase)
  if (fala && !NIVEL_COMO_CONDICAO.test(texto) && (SAIDA_AFIRMA_NIVEL.some((padrao) => padrao.test(texto)) || (FALA_DO_CRITERIO.test(texto) && SAIDA_DE_NIVEL_NA_RUBRICA.test(texto)))) return 'nivel'
  if (fala && !FALA_DO_CRITERIO.test(texto) && SAIDA_JULGA_O_TEXTO.some((padrao) => padrao.test(texto))) return 'julga'
  if (SAIDA_AO_PROFESSOR.test(texto) || SAIDA_QUE_RECUSA.test(texto)) return undefined
  if ((SAIDA_SUJEITO_PESSOA.test(texto) || saidaCitaPessoa(frase)) && !FALA_DO_CRITERIO.test(texto) && SAIDA_DESEMPENHO.test(texto)) return 'desempenho'
  return undefined
}

function razaoDoJulgamento(texto: string): Razao[] {
  const frases = texto.split(/[.!?\n;]+/u)
  const inteira = ehRubricaInteira(frases)
  return frases.flatMap((frase) => razaoNaFrase(frase, inteira) ?? [])
}

/**
 * A saída **julga texto concreto de aluno**? É a segunda conferência da D55 (regra 70, item 2a): a saída aponta para o
 * texto ("o parágrafo 2", "seu texto") e diz que está bom, fraco, com erro, no nível 3, melhor que outro, ou o que
 * reescrever; ou escreve a rubrica sob medida para ele. **Só conta com a segunda chave**: a conversa traz texto de aluno
 * (`conversaTrazTextoDeAluno`). Sem texto de aluno na conversa, a rubrica, os critérios e a organização do lote passam,
 * e com ele passam também o agrupamento por tema, a correção cega e a conferência de entrega, que não julgam nada.
 *
 * O que ela não pega, dito com franqueza: elogio ou crítica em palavra que as listas não conhecem ("Excelente!", "Muito
 * bem!", "Confuso e vago."), e o juízo dito sem verbo de desempenho. Está medido e declarado no `onda-0.md` §2.3; o prompt
 * proíbe julgar texto de aluno, e o refinamento vai medido no lote retido do `ouro`.
 */
export function julgaTextoDeAluno(texto: string, conversaTrazTextoDeAluno: boolean): boolean {
  return conversaTrazTextoDeAluno && razaoDoJulgamento(texto).length > 0
}

const PROBLEMA_DO_JULGAMENTO =
  'A resposta julga texto de aluno: diz se está bom ou fraco, aponta erro, compara, dá nível de rubrica ou sugere reescrita. Você não avalia texto nem resposta de aluno: reescreva sem juízo sobre o que ele escreveu, dizendo que a correção é do professor.'

/** Os problemas que são da D55: a reserva só responde a estes. */
const PROBLEMAS_DA_D55: readonly string[] = [PROBLEMA_DA_NOTA, PROBLEMA_DO_JULGAMENTO]

const PEDE_ADAPTACAO = /\badapt\w*/
const PEDE_PLANO = /\b(planos? de aulas?|planej\w+|sequencia didatica|roteiro de aula)\b/
const PEDE_ATIVIDADE = /\b(atividades?|exercicios?|questoes|questao|lista|quiz|prova|simulado)\b/

/** Onde o assunto acaba: pontuação, a quantidade, a duração, e o "para…", "do aluno…", "que tem…" que falam de gente. */
const FIM_DO_TEMA = String.raw`(?=[.?!\n,;:]|\s+com\s+\d|\s+(?:para|pra|pro)s?\s+|\s+de\s+\d+\s+min|\s+d[oa]s?\s+(?:alun|estudante|turma|\d)|\s+que\s+|\s+porque\s+|$)`
const TEMA_DEPOIS_DE_SOBRE = new RegExp(String.raw`\b(?:sobre|a respeito de|acerca de)\s+(.+?)${FIM_DO_TEMA}`, 'iu')
/** Sem "sobre": o que vem depois do nome da ferramenta e de um "de" ("uma atividade de estequiometria", "lista de exercícios de mol"). */
const TEMA_DEPOIS_DA_FERRAMENTA = new RegExp(
  String.raw`\b(?:atividades?|exerc[ií]cios?|quest(?:ões|ão|oes|ao)|listas?(?:\s+de\s+exerc[ií]cios?)?|quiz|provas?|simulados?|planos?\s+de\s+aulas?|sequ[eê]ncia\s+did[aá]tica|roteiro\s+de\s+aula)(?:\s+objetivas?)?(?:\s+com\s+\d+\s+\S+)?\s+d[eoa]s?\s+(?!\d)(.+?)${FIM_DO_TEMA}`,
  'iu',
)
/** Palavra que diz de uma pessoa, e não de um assunto: tema com ela não é tema. */
const FALA_DE_PESSOA = /\b(alun\w+|estudante\w*|laudo\w*|diagnostic\w*|dislexi\w*|discalculi\w*|tdah|autis\w*|tea|deficien\w*|sindrome\w*|transtorno\w*|baixa visao|ceg[oa]s?|surd[oa]s?|especia(l|is)|inclus\w*)\b/

/**
 * O **assunto** do pedido, para o cartão abrir preenchido: o que vem depois de "sobre", ou depois do nome da ferramenta
 * e de um "de". Para antes de "para…", "do aluno…" e "que tem…", que falam de gente, e não aceita tema que cite aluno
 * ou condição. Sem assunto claro, **não copia a mensagem**: o tema fica sendo a disciplina, e o professor o ajusta no
 * cartão. O que ele disse sobre um aluno nunca vira tema, e por isso não vira título de artefato nem de PDF.
 */
function temaDaMensagem(mensagem: string, disciplina: string): string {
  const achado = TEMA_DEPOIS_DE_SOBRE.exec(mensagem) ?? TEMA_DEPOIS_DA_FERRAMENTA.exec(mensagem)
  const tema = (achado?.[1] ?? '').trim()
  if (tema.length === 0 || FALA_DE_PESSOA.test(normalizar(tema))) return cortar(disciplina, TAMANHO_MAXIMO_DO_TEMA)
  return cortar(tema, TAMANHO_MAXIMO_DO_TEMA)
}

function numeroEntre(achado: RegExpExecArray | null, minimo: number, maximo: number): number | undefined {
  const numero = Number(achado?.[1])
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : undefined
}

/**
 * A resposta de quem escolheu "só conversar": texto, sobre o **último pedido** do professor (o turno anterior dele mais
 * recente; sem turno anterior, a mensagem de agora), com a página citada quando o material tem o que dizer. Nunca proposta.
 */
function respostaSoEmTexto(entrada: EntradaDoAssistente): SaidaDoAssistente {
  const pedido = entrada.turnosAnteriores.findLast((turno) => turno.autor === 'professor')?.texto ?? entrada.mensagem
  if (PEDE_ADAPTACAO.test(normalizar(pedido))) {
    return {
      tipo: 'texto',
      texto: 'Sem abrir ferramenta, então. Para adaptar, abra a atividade e escolha “Adaptar”: ela pede só o tipo de adaptação, sem nenhuma informação sobre o aluno, e a versão adaptada espera a sua aprovação.',
      citacoes: [],
    }
  }
  const frase = fatoCitadoNoTexto(extrairFatos(entrada.trechos), pedido) ?? fraseMaisProxima(frasesDoMaterial(entrada.trechos), pedido)
  if (frase !== undefined) {
    return {
      tipo: 'texto',
      texto: cortar(`Sem abrir a ferramenta, então. No material da turma, a página ${frase.pagina} diz: “${frase.frase}” Se quiser, pergunte por outro ponto do capítulo.`, 8000),
      citacoes: [citacaoDaFrase(frase)],
    }
  }
  return {
    tipo: 'texto',
    texto: 'Sem abrir a ferramenta, então. Não achei no material da turma um trecho sobre esse pedido: diga o assunto com outras palavras, ou pergunte por um conceito do capítulo, e eu respondo com a página.',
    citacoes: [],
  }
}

export const proporFerramenta = definirTarefa({
  nome: 'propor_ferramenta',
  funcao: 'conversa_e_ferramentas',
  perfil: 'rapido',
  esquemaDeEntrada: esquemaEntradaDoAssistente,
  esquemaDeSaida: esquemaSaidaDoAssistente,
  prompt: PROMPT_PROPOR_FERRAMENTA,
  maximoDeTokensDeSaida: 800,
  levaTextoLivreDePessoa: true,
  // O professor pode colar texto de aluno na conversa. A regra fixa segura o pedido de julgamento antes do modelo, mas o
  // texto colado sem pedido que ela reconheça segue para o provedor: a declaração é a do pior caso (D62).
  levaTextoDeAluno: true,

  /**
   * A regra da D55 na frente do modelo: pedido de nota, conceito ou pontuação, ou de julgamento de texto de aluno,
   * recebe a recusa fixa **sem chamar modelo nenhum**, qualquer que seja o adaptador. A mensagem não sai daqui.
   */
  semModelo(entrada): SaidaDoAssistente | undefined {
    return conversaPedeJulgamentoDeTextoDeAluno(entrada.mensagem, entrada.turnosAnteriores, entrada.semProposta === true) ? { tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] } : undefined
  },

  montarPedido(entrada) {
    return {
      instrucao:
        entrada.semProposta === true
          ? 'O professor escolheu só conversar, sem abrir ferramenta. Responda em texto ao último pedido dele (o turno anterior do professor mais recente; se não houver, a mensagem de agora), citando a página quando a resposta vier do material. A saída é do tipo "texto": não devolva "proposta_de_ferramenta".'
          : 'Responda à mensagem do professor: proponha abrir uma ferramenta, se o pedido corresponder a uma, ou responda em texto.',
      dados: [
        dadoEmJson('serie_e_disciplina', entrada.contexto),
        ...dadosDosTrechos(entrada.trechos),
        // Turno que a regra recusaria, e texto colado, não vão ao modelo (D55).
        ...turnosQuePodemIrAoModelo(entrada.turnosAnteriores).map((turno) => ({ tipo: turno.autor === 'professor' ? 'turno_anterior_do_professor' : 'turno_anterior_do_assistente', corpo: turno.texto })),
        { tipo: 'mensagem_do_professor_agora', corpo: entrada.mensagem },
      ],
    }
  },

  /**
   * A reserva da D55: o modelo insistiu em julgar duas vezes, e quem responde é a recusa fixa. Só quando a **última**
   * reprovação foi da D55: citação inválida sem julgamento segue falha (`IA_SAIDA_INVALIDA`), como o JSON quebrado, que nem
   * chega aqui. A recusa passa pelas duas conferências da D55 e pelo schema, e a chamada gasta as duas tentativas.
   */
  reservaQuandoInvalida(_entrada, problemas = []): SaidaDoAssistente | undefined {
    if (!problemas.some((problema) => PROBLEMAS_DA_D55.includes(problema))) return undefined
    return { tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] }
  },

  conferir(entrada, saida) {
    // Nota, conceito ou pontuação, e juízo sobre texto de aluno, na resposta são pré-correção (D55): nunca são gravados,
    // venha do pedido que vier. A proposta de ferramenta tem o `texto` dela, e é conferida do mesmo jeito.
    const daNota = atribuiNotaOuConceito(saida.texto) ? [PROBLEMA_DA_NOTA] : []
    const doJulgamento = julgaTextoDeAluno(saida.texto, conversaTrazTextoDeAluno(entrada.mensagem, entrada.turnosAnteriores)) ? [PROBLEMA_DO_JULGAMENTO] : []
    const daD55 = [...daNota, ...doJulgamento]
    if (saida.tipo === 'texto') return [...daD55, ...problemasDasCitacoes(saida.citacoes, entrada.trechos, 'Citações')]
    // Quem escolheu só conversar não recebe a mesma pergunta de novo: proposta, aqui, é saída inválida.
    return [...daD55, ...(entrada.semProposta === true ? ['O professor escolheu só conversar: responda com "tipo": "texto", sem "proposta_de_ferramenta".'] : [])]
  },

  falso(entrada): SaidaDoAssistente {
    if (entrada.semProposta === true) return respostaSoEmTexto(entrada)
    const texto = normalizar(entrada.mensagem)
    if (PEDE_ADAPTACAO.test(texto)) {
      // O que o professor disse sobre o aluno não é repetido: a resposta só aponta a ferramenta, que pede o tipo.
      return {
        tipo: 'texto',
        texto: 'A Adaptação parte de uma atividade que já existe: abra a atividade e escolha “Adaptar”. Ela pede só o tipo de adaptação, sem nenhuma informação sobre o aluno, e a versão adaptada espera a sua aprovação.',
        citacoes: [],
      }
    }
    if (PEDE_PLANO.test(texto)) {
      const tema = temaDaMensagem(entrada.mensagem, entrada.contexto.disciplina)
      return {
        tipo: 'proposta_de_ferramenta',
        texto: cortar(`Quer que eu abra a ferramenta de plano de aula sobre “${tema}”? Você ajusta antes de gerar.`, 1000),
        proposta: { ferramenta: 'plano_de_aula', parametros: { tema } },
      }
    }
    if (PEDE_ATIVIDADE.test(texto)) {
      const tema = temaDaMensagem(entrada.mensagem, entrada.contexto.disciplina)
      const quantidade = numeroEntre(/(\d{1,2})\s*(?:questoes|questao|exercicios?|perguntas?|itens)\b/.exec(texto), 1, MAXIMO_DE_QUESTOES_POR_ATIVIDADE)
      return {
        tipo: 'proposta_de_ferramenta',
        texto: cortar(`Quer que eu abra a ferramenta de atividade objetiva${quantidade === undefined ? '' : ` com ${quantidade} questões`} sobre “${tema}”? Você ajusta antes de gerar.`, 1000),
        proposta: { ferramenta: 'atividade_objetiva', parametros: quantidade === undefined ? { tema } : { tema, quantidade } },
      }
    }
    // Pergunta sobre um conceito que o material define é respondida com a definição dele, e não com a frase mais parecida.
    const frase = fatoCitadoNoTexto(extrairFatos(entrada.trechos), entrada.mensagem) ?? fraseMaisProxima(frasesDoMaterial(entrada.trechos), entrada.mensagem)
    if (frase !== undefined) {
      return {
        tipo: 'texto',
        texto: cortar(`No material da turma, a página ${frase.pagina} diz: “${frase.frase}” Posso montar uma atividade objetiva ou um plano de aula sobre isso: é só pedir.`, 8000),
        citacoes: [citacaoDaFrase(frase)],
      }
    }
    return {
      tipo: 'texto',
      texto: 'Eu preparo atividade objetiva, plano de aula e versão adaptada de atividade, sempre a partir do material que a escola subiu e com a página citada. Diga o tema e eu pergunto se você quer abrir a ferramenta.',
      citacoes: [],
    }
  },
})
