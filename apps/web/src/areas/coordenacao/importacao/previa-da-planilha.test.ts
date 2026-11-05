import type { CandidatoDaMarca, PreviaDaPlanilhaRow } from '@educa/shared'
import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../api/client'
import { ImportacaoNaoConcluidaError } from './api/importacao'
import {
  alternarMarca,
  alternarTodos,
  candidatosDa,
  fatiaDaLista,
  frasesDoResto,
  itensEscondidos,
  ITENS_POR_PAGINA,
  linhasDeErroEDeAviso,
  linhasDeFora,
  marcasParaEnviar,
  MOTIVO_DE_NADA_NOVO,
  MOTIVO_DO_DOCUMENTO,
  MOTIVO_DO_ERRO_NA_PLANILHA,
  podeGravar,
  previaEnvelheceu,
  resumoDasMarcas,
  SEM_MARCAS,
  TEXTO_DA_CONFERENCIA,
  TEXTO_DA_IMPORTACAO_DESATUALIZADA,
  TEXTO_DO_AVISO_DESCONHECIDO,
  TEXTO_DO_CONFLITO_DO_GRAVAR,
  TEXTO_DO_ERRO_DA_LINHA,
  TEXTO_DO_ERRO_DESCONHECIDO,
  textoDaConclusao,
  textoDaFalhaDaGravacao,
  textoDaFalhaDaPrevia,
  textoDoAviso,
  textoDoErro,
  totalDeMarcas,
} from './previa-da-planilha'

const linha = (numero: number, resultado: PreviaDaPlanilhaRow['resultado'], extra: Partial<PreviaDaPlanilhaRow> = {}): PreviaDaPlanilhaRow => ({ linha: numero, resultado, ...extra })
const candidato = (id: string, acao: CandidatoDaMarca['acao'], rotulo = `Aluno ${id} (${id}00)`): CandidatoDaMarca => ({ id, acao, rotulo })

describe('13.0 (unidade): a prévia da planilha em texto', () => {
  it('cada erro de linha tem uma frase própria que diz o que fazer, e o código desconhecido não some em branco', () => {
    // "Diz o que fazer" é o verbo de ação de cada frase, não o tamanho dela: sem o verbo, o código novo que entrar sem frase boa fica vermelho.
    const oQueFazer: Readonly<Record<string, RegExp>> = {
      turma_vazia: /Escreva a turma/,
      turma_invalida: /Escreva o ano e a letra/,
      turma_ambigua: /Renomeie uma delas/,
      sem_nome: /Preencha a coluna "nome"/,
      nome_invalido: /Confira o nome/,
      sem_matricula: /Preencha a coluna "matricula"/,
      matricula_invalida: /Confira a matrícula/,
      matricula_notacao_cientifica: /deixe a coluna como texto/,
      matricula_parece_documento: /troque pela matrícula da escola/,
      matricula_repetida: /corrija ou tire as repetidas/,
      aluno_desativado: /Tire esta linha da planilha/,
      linha_incompleta: /Confira se cada dado está na sua coluna/,
    }
    expect(Object.keys(TEXTO_DO_ERRO_DA_LINHA).sort()).toEqual(Object.keys(oQueFazer).sort())
    for (const [codigo, texto] of Object.entries(TEXTO_DO_ERRO_DA_LINHA)) {
      expect(texto, codigo).toMatch(oQueFazer[codigo] ?? /^$/)
      expect(texto, codigo).not.toContain(codigo)
    }
    expect(Object.keys(TEXTO_DO_ERRO_DA_LINHA)).toEqual(
      expect.arrayContaining(['turma_vazia', 'turma_invalida', 'turma_ambigua', 'sem_nome', 'sem_matricula', 'matricula_repetida', 'matricula_notacao_cientifica', 'matricula_parece_documento', 'aluno_desativado', 'linha_incompleta']),
    )
    expect(textoDoErro('codigo_que_a_tela_nao_conhece')).toBe(TEXTO_DO_ERRO_DESCONHECIDO)
    expect(textoDoErro(undefined)).toBe(TEXTO_DO_ERRO_DESCONHECIDO)
  })

  it('o aviso de uma linha que grava assim mesmo nunca some em branco: o código que a tela não conhece cai no texto de conferir', () => {
    expect(textoDoAviso('codigo_que_a_tela_nao_conhece')).toBe(TEXTO_DO_AVISO_DESCONHECIDO)
    expect(textoDoAviso(undefined)).toBe(TEXTO_DO_AVISO_DESCONHECIDO)
    expect(TEXTO_DO_AVISO_DESCONHECIDO).toContain('Confira esta linha')
  })

  it('os erros e os avisos vêm primeiro e na ordem da planilha; o resto vira contagem, com o nome corrigido e a mudança de turma ditos por extenso', () => {
    const linhas = [
      linha(9, 'entra'),
      linha(7, 'erro', { erro: 'sem_nome' }),
      linha(3, 'erro', { erro: 'sem_matricula' }),
      linha(5, 'ja_existe', { aviso: 'x' }),
      linha(2, 'entra'),
      linha(4, 'nome_corrigido'),
      linha(6, 'muda_de_turma'),
      linha(8, 'ja_existe'),
      linha(10, 'volta'),
    ]
    const { erros, avisos } = linhasDeErroEDeAviso(linhas)
    expect(erros.map((l) => l.linha)).toEqual([3, 7])
    expect(avisos.map((l) => l.linha)).toEqual([5])
    expect(frasesDoResto(linhas)).toEqual([
      '2 linhas entram',
      '1 linha volta de um ano anterior, para a turma que a linha escreve',
      '1 linha tem o nome corrigido para o da planilha',
      '1 linha aparece em outra turma (só muda com a sua marca)',
      '2 linhas já existem, e nada muda',
    ])
  })

  it('a lista longa mostra 100 por vez e diz quantas ainda escondeu', () => {
    const itens = Array.from({ length: 250 }, (_, posicao) => posicao)
    expect(ITENS_POR_PAGINA).toBe(100)
    expect(fatiaDaLista(itens, 1)).toHaveLength(100)
    expect(itensEscondidos(250, 1)).toBe(150)
    expect(fatiaDaLista(itens, 3)).toHaveLength(250)
    expect(itensEscondidos(250, 3)).toBe(0)
  })
})

describe('13.0 (unidade): quando a gravação é oferecida', () => {
  it('com erro, não: o motivo manda corrigir a planilha e escolher o arquivo de novo', () => {
    expect(podeGravar({ linhas: [linha(2, 'entra'), linha(3, 'erro', { erro: 'sem_nome' })] }, 0)).toEqual({ pode: false, motivo: MOTIVO_DO_ERRO_NA_PLANILHA })
    // Nem a marca abre a gravação de uma planilha com erro (RF2).
    expect(podeGravar({ linhas: [linha(3, 'erro', { erro: 'sem_nome' })] }, 5).pode).toBe(false)
  })

  it('a coluna que parece CPF ou data segura a gravação com o motivo dela; a matrícula de verdade, não', () => {
    for (const qual of [1, 2, 40]) {
      const linhas = Array.from({ length: qual }, (_, posicao) => linha(posicao + 2, 'erro', { erro: 'matricula_parece_documento' }))
      expect(podeGravar({ linhas }, 0), String(qual)).toEqual({ pode: false, motivo: MOTIVO_DO_DOCUMENTO })
    }
    // Um erro de outro tipo junto: vale o motivo geral.
    expect(podeGravar({ linhas: [linha(2, 'erro', { erro: 'matricula_parece_documento' }), linha(3, 'erro', { erro: 'sem_nome' })] }, 0)).toEqual({ pode: false, motivo: MOTIVO_DO_ERRO_NA_PLANILHA })
    expect(podeGravar({ linhas: [linha(2, 'entra')] }, 0)).toEqual({ pode: true })
  })

  it('só grava com algo novo: o nome corrigido e o aluno que volta gravam; "já existe" sozinho não, a não ser com marca', () => {
    expect(podeGravar({ linhas: [linha(2, 'ja_existe')] }, 0)).toEqual({ pode: false, motivo: MOTIVO_DE_NADA_NOVO })
    expect(podeGravar({ linhas: [linha(2, 'muda_de_turma')] }, 0).pode).toBe(false)
    expect(podeGravar({ linhas: [linha(2, 'muda_de_turma')] }, 1)).toEqual({ pode: true })
    expect(podeGravar({ linhas: [linha(2, 'nome_corrigido')] }, 0)).toEqual({ pode: true })
    expect(podeGravar({ linhas: [linha(2, 'volta')] }, 0)).toEqual({ pode: true })
  })
})

describe('13.0 (unidade): as marcas são escolha da coordenação (regra 70, item 2)', () => {
  const candidatos = [candidato('a', 'transferir'), candidato('b', 'transferir'), candidato('c', 'desligar'), candidato('d', 'encerrar')]

  it('nada chega marcado, e o gravar sem marca manda listas vazias', () => {
    expect(totalDeMarcas(SEM_MARCAS)).toBe(0)
    expect(marcasParaEnviar(SEM_MARCAS)).toEqual({ transferir: [], desligar: [], encerrar: [] })
  })

  it('marcar um é só dele; marcar de novo desmarca; as outras ações não mexem', () => {
    const marcado = alternarMarca(SEM_MARCAS, 'transferir', 'a')
    expect(marcasParaEnviar(marcado)).toEqual({ transferir: ['a'], desligar: [], encerrar: [] })
    expect(marcasParaEnviar(alternarMarca(marcado, 'transferir', 'a'))).toEqual({ transferir: [], desligar: [], encerrar: [] })
    // A marcação anterior não é alterada (estado imutável).
    expect(totalDeMarcas(SEM_MARCAS)).toBe(0)
  })

  it('"marcar todos" marca só os candidatos da ação, e marcado todos, desmarca todos', () => {
    const todos = alternarTodos(SEM_MARCAS, 'transferir', candidatos)
    expect(marcasParaEnviar(todos)).toEqual({ transferir: ['a', 'b'], desligar: [], encerrar: [] })
    expect(marcasParaEnviar(alternarTodos(todos, 'transferir', candidatos))).toEqual({ transferir: [], desligar: [], encerrar: [] })
    // Marcado um só, "marcar todos" completa o grupo em vez de desmarcá-lo.
    expect(marcasParaEnviar(alternarTodos(alternarMarca(SEM_MARCAS, 'transferir', 'a'), 'transferir', candidatos)).transferir).toEqual(['a', 'b'])
    expect(candidatosDa(candidatos, 'desligar').map((c) => c.id)).toEqual(['c'])
  })

  it('o texto diz que a lista é uma conferência, e que cada pessoa só muda se a coordenação marcar', () => {
    expect(TEXTO_DA_CONFERENCIA).toContain('conferência')
    expect(TEXTO_DA_CONFERENCIA).toContain('não um resultado automático')
    expect(TEXTO_DA_CONFERENCIA).toContain('só é transferida, desligada ou tirada da grade se você marcar')
  })
})

describe('13.0 (unidade): o que a tela diz ao terminar e ao falhar', () => {
  const NADA_DE_FORA = { semMarca: 0, mudaram: 0 }

  it('a conclusão conta quantas entraram, e as linhas que ficaram de fora, cada uma com o seu porquê', () => {
    expect(textoDaConclusao({ entram: 3, nomes_corrigidos: 1, turmas_novas: 2 }, NADA_DE_FORA)).toBe('3 alunos entraram. 1 nome foi corrigido. 2 turmas novas foram criadas. Nenhuma linha ficou de fora.')
    // "Quantos entraram" aparece sempre, também quando é zero: a coordenação lê que ninguém entrou.
    expect(textoDaConclusao({ transferidos: 1 }, NADA_DE_FORA)).toBe('0 alunos entraram. 1 aluno mudou de turma. Nenhuma linha ficou de fora.')
    expect(textoDaConclusao(null, NADA_DE_FORA)).toBe('0 alunos entraram. Nenhuma linha ficou de fora.')
    expect(textoDaConclusao({ entram: 1, voltam: 1, transferidos: 1, desligados: 1, retirados: 1 }, { semMarca: 2, mudaram: 0 })).toBe(
      '2 alunos entraram. 1 aluno mudou de turma. 2 alunos saíram. 2 linhas ficaram de fora: o aluno aparece em outra turma e você não marcou a transferência.',
    )
    // A linha que a prévia dava como gravada e a escola mudou antes do gravar: a tela não diz "nenhuma ficou de fora".
    const mudou = textoDaConclusao({ entram: 1 }, { semMarca: 0, mudaram: 1 })
    expect(mudou).toBe(
      '1 aluno entrou. 1 linha ficou de fora: a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.',
    )
    expect(mudou).not.toContain('Nenhuma linha ficou de fora')
    // As duas causas juntas: cada uma com a sua frase.
    expect(textoDaConclusao(null, { semMarca: 1, mudaram: 2 })).toBe(
      '0 alunos entraram. 1 linha ficou de fora: o aluno aparece em outra turma e você não marcou a transferência. 2 linhas ficaram de fora: a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.',
    )
  })

  it('as linhas "em outra turma" que a coordenação não marcou ficaram de fora por falta de marca', () => {
    const linhas = [linha(2, 'muda_de_turma'), linha(3, 'muda_de_turma'), linha(4, 'muda_de_turma')]
    expect(linhasDeFora(linhas, SEM_MARCAS, null).semMarca).toBe(3)
    expect(linhasDeFora(linhas, alternarMarca(SEM_MARCAS, 'transferir', 'a'), null).semMarca).toBe(2)
    expect(linhasDeFora(linhas, alternarTodos(SEM_MARCAS, 'transferir', [candidato('a', 'transferir'), candidato('b', 'transferir'), candidato('c', 'transferir')]), null).semMarca).toBe(0)
    // Marca a mais do que linhas: nunca negativo.
    expect(linhasDeFora([linha(2, 'entra')], alternarMarca(SEM_MARCAS, 'transferir', 'a'), null).semMarca).toBe(0)
  })

  it('a linha que a prévia dava como gravada e o resumo não contou ficou de fora porque a escola mudou; o que gravou fecha a conta', () => {
    const linhas = [linha(2, 'entra'), linha(3, 'entra'), linha(4, 'volta'), linha(5, 'nome_corrigido'), linha(6, 'ja_existe')]
    // Tudo gravou: nada de fora ("já existe" nunca esteve na conta).
    expect(linhasDeFora(linhas, SEM_MARCAS, { entram: 2, voltam: 1, nomes_corrigidos: 1 })).toEqual({ semMarca: 0, mudaram: 0 })
    // Uma entrada, a volta e o nome corrigido não gravaram: três de fora.
    expect(linhasDeFora(linhas, SEM_MARCAS, { entram: 1 }).mudaram).toBe(3)
    expect(linhasDeFora(linhas, SEM_MARCAS, null).mudaram).toBe(4)
    // Gravou a mais do que a prévia dizia (outra pessoa pôs uma linha): nunca negativo.
    expect(linhasDeFora([linha(2, 'entra')], SEM_MARCAS, { entram: 3 }).mudaram).toBe(0)
  })

  it('o resumo das marcas diz o que cada marca vai fazer, no singular e no plural, e some sem marca', () => {
    expect(resumoDasMarcas(SEM_MARCAS)).toBeUndefined()
    const transferir = alternarTodos(SEM_MARCAS, 'transferir', [candidato('a', 'transferir'), candidato('b', 'transferir')])
    expect(resumoDasMarcas(transferir)).toBe('Ao gravar, com as suas marcas: 2 alunos mudarão de turma.')
    const todas = alternarMarca(alternarMarca(alternarMarca(SEM_MARCAS, 'transferir', 'a'), 'desligar', 'c'), 'encerrar', 'd')
    expect(resumoDasMarcas(todas)).toBe('Ao gravar, com as suas marcas: 1 aluno mudará de turma; 1 aluno será desligado e perde o acesso; 1 vínculo de professor será encerrado.')
    expect(resumoDasMarcas(alternarTodos(SEM_MARCAS, 'desligar', [candidato('c', 'desligar'), candidato('e', 'desligar'), candidato('f', 'desligar')]))).toBe(
      'Ao gravar, com as suas marcas: 3 alunos serão desligados e perdem o acesso.',
    )
  })

  it('a prévia recusada diz o que conferir; a que a lista da turma passa os próprios textos', () => {
    expect(textoDaFalhaDaPrevia(new ApiError(ErrorCode.ENTRADA_INVALIDA))).toContain('cabeçalho do modelo')
    expect(textoDaFalhaDaPrevia(new ApiError(ErrorCode.ENTRADA_INVALIDA), { [ErrorCode.ENTRADA_INVALIDA]: 'da turma' })).toBe('da turma')
  })

  it('"outra importação em andamento" e "a escola mudou desde a prévia" são textos diferentes, e só o segundo tira a prévia', () => {
    const conflito = new ApiError(ErrorCode.CONFLITO)
    const desatualizada = new ImportacaoNaoConcluidaError('desatualizada', null)
    expect(textoDaFalhaDaGravacao(conflito)).toBe(TEXTO_DO_CONFLITO_DO_GRAVAR)
    expect(textoDaFalhaDaGravacao(desatualizada)).toBe(TEXTO_DA_IMPORTACAO_DESATUALIZADA)
    expect(TEXTO_DO_CONFLITO_DO_GRAVAR).not.toBe(TEXTO_DA_IMPORTACAO_DESATUALIZADA)
    expect(previaEnvelheceu(conflito)).toBe(false)
    expect(previaEnvelheceu(desatualizada)).toBe(true)
    expect(previaEnvelheceu(new ImportacaoNaoConcluidaError('falhou', 'expirou'))).toBe(false)
    expect(previaEnvelheceu(new ApiError(ErrorCode.NAO_ENCONTRADO))).toBe(true)
    expect(previaEnvelheceu(new ApiError(ErrorCode.ENTRADA_INVALIDA))).toBe(true)
    expect(previaEnvelheceu(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(false)
  })

  it('a importação que falhou diz a causa e que nada foi gravado', () => {
    for (const erro of ['expirou', 'trava_esgotada', 'erro_interno'] as const) {
      expect(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', erro)), erro).toContain('Nada foi gravado')
    }
    // A causa que o servidor não disse cai no erro interno, e a tela ainda diz que nada foi gravado.
    expect(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', null))).toContain('Nada foi gravado')
    expect(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', null))).toBe(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', 'erro_interno')))
    expect(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', 'expirou'))).not.toBe(textoDaFalhaDaGravacao(new ImportacaoNaoConcluidaError('falhou', 'trava_esgotada')))
  })
})
