import type { ConteudoDeAtividade, ConteudoDePlanoDeAula, FonteDoArtefato, QuestaoObjetiva } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { extrairTextoPorPagina } from '../../../../tools/demonstracao/extrair-texto.ts'
import { AVISO_DE_IA_NO_PDF, AVISO_DE_IA_NO_RASCUNHO, gerarPdfDoArtefato, MARCA_DE_RASCUNHO, nomeDoArquivoDoPdf, textoParaAFontePadrao } from './pdf-do-artefato.js'

const MATERIAL = '0190f5a0-0000-7000-8000-0000000000a1'
const TITULO_DO_MATERIAL = 'Química 2 — Capítulo 7: Estequiometria'
/** As `fontes` do artefato como o PDF as recebe: o título, a edição e se a edição foi substituída. */
const comFonte = (fonte: Partial<FonteDoArtefato> = {}) => new Map<string, FonteDoArtefato>([[MATERIAL, { materialId: MATERIAL, titulo: TITULO_DO_MATERIAL, edicao: null, substituido: false, ...fonte }]])
const TITULOS = comFonte()
const umaLinha = (texto: string): string => texto.replace(/\s+/g, ' ').trim()

function questao(numero: number, gabarito = numero % 4): QuestaoObjetiva {
  return {
    enunciado: `Segundo o material, o que acontece na reação ${String(numero)}: 2 H₂ + O₂ → 2 H₂O, com 6,02 × 10²³ partículas?`,
    alternativas: [`A água da questão ${String(numero)} é formada.`, 'O CO₂ é consumido.', 'Nada reage; a massa “some”.', 'O rendimento é de 80%.'],
    gabarito,
    habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' },
    citacao: { materialId: MATERIAL, pagina: (numero % 6) + 1, trecho: 'A proporção em mol é dada pelos coeficientes.' },
    explicacao: 'Na página citada, o material diz isso.',
  }
}

const atividade = (quantidade: number): ConteudoDeAtividade => ({ tipo: 'atividade_objetiva', titulo: 'Atividade — estequiometria', questoes: Array.from({ length: quantidade }, (_, indice) => questao(indice + 1)) })

describe('textoParaAFontePadrao: o que a fonte padrão do PDF não escreve vira o equivalente que ela tem', () => {
  it.each([
    ['H₂O e CO₂', 'H2O e CO2'],
    ['2 H₂ + O₂ → 2 H₂O', '2 H2 + O2 -> 2 H2O'],
    ['N₂ + 3 H₂ ⇌ 2 NH₃', 'N2 + 3 H2 <-> 2 NH3'],
    ['6,02 × 10²³', '6,02 × 10²³'],
    ['1 × 10⁻⁴ mol', '1 × 10^-4 mol'],
    ['Na⁺ e Ca²⁺', 'Na+ e Ca^2+'],
    ['ΔH ≥ 0', 'Delta H >= 0'],
    ['50 µg — “aspas” e reticências…', '50 µg — “aspas” e reticências…'],
    ['espaço duro​ e\ttab', 'espaço duro e tab'],
    ['ação, coração, PÃO', 'ação, coração, PÃO'],
    ['ș e 中', 's e ?'],
  ])('%s → %s', (entrada, esperado) => {
    expect(textoParaAFontePadrao(entrada)).toBe(esperado)
  })

  it('o que o material de demonstração escreve (H2O, CO2, -> e 10²³) passa sem mudar', () => {
    const doMaterial = 'CH4 + 2 O2 -> CO2 + 2 H2O; 1 mol corresponde a 6,02 × 10²³ partículas.'
    expect(textoParaAFontePadrao(doMaterial)).toBe(doMaterial)
  })
})

describe('nomeDoArquivoDoPdf: nada do título entra cru no cabeçalho', () => {
  it('só letras minúsculas, algarismos e hífen; título vazio de letra vira "artefato"', () => {
    expect(nomeDoArquivoDoPdf('Atividade — Estequiometria (2ºB)')).toBe('atividade-estequiometria-2-b.pdf')
    expect(nomeDoArquivoDoPdf('x"\r\nSet-Cookie: a=b')).toBe('x-set-cookie-a-b.pdf')
    expect(nomeDoArquivoDoPdf('—')).toBe('artefato.pdf')
    expect(nomeDoArquivoDoPdf('a'.repeat(200))).toBe(`${'a'.repeat(60)}.pdf`)
  })
})

describe('gerarPdfDoArtefato', () => {
  it('a atividade de 20 questões sai bem abaixo de dois segundos, com as questões, as alternativas, a página de origem e o gabarito numa página à parte', async () => {
    const conteudo = atividade(20)
    await gerarPdfDoArtefato(atividade(1), TITULOS) // a primeira geração do processo carrega as métricas da fonte
    const inicio = performance.now()
    const bytes = await gerarPdfDoArtefato(conteudo, TITULOS)
    const duracaoMs = performance.now() - inicio
    expect(duracaoMs).toBeLessThan(2_000)

    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    const paginas = (await extrairTextoPorPagina(bytes)).map(umaLinha)
    const gabarito = paginas.at(-1) ?? ''
    const folhas = paginas.slice(0, -1).join(' ')
    expect(paginas.length).toBeGreaterThan(2)
    expect(paginas[0]).toContain('Atividade — estequiometria')
    expect(paginas[0]).toContain(umaLinha(AVISO_DE_IA_NO_PDF))
    for (const numero of [1, 7, 20]) {
      expect(folhas).toContain(`${String(numero)}. Segundo o material, o que acontece na reação ${String(numero)}: 2 H2 + O2 -> 2 H2O, com 6,02 × 10²³ partículas?`)
      expect(folhas).toContain(`A) A água da questão ${String(numero)} é formada.`)
    }
    expect(folhas).toContain('B) O CO2 é consumido.')
    expect(folhas).toContain('C) Nada reage; a massa “some”.')
    expect(folhas).toContain('Fonte: Química 2 — Capítulo 7: Estequiometria, p. 2')
    // O gabarito só na última página, e a folha do aluno sem ele.
    expect(gabarito).toContain('Gabarito — Atividade — estequiometria')
    expect(gabarito).toContain('1. B — QUI.EM.04')
    expect(gabarito).toContain('20. A — QUI.EM.04')
    expect(folhas).not.toContain('Gabarito')
    expect(folhas).not.toContain('QUI.EM.04')
    // Nenhum caractere quebrado: o que a fonte não tem foi trocado antes, e as únicas interrogações são as dos 20 enunciados.
    expect(paginas.join(' ')).not.toMatch(/[₀-₉→\uFFFD]/u)
    expect(paginas.join(' ').match(/\?/gu)).toHaveLength(20)
  })

  it('o rodapé de cada questão diz o título, a edição e "edição anterior" da fonte; sem edição, só o título', async () => {
    const rodape = async (fontes: ReturnType<typeof comFonte>, conteudo: ConteudoDeAtividade | ConteudoDePlanoDeAula = atividade(1)) =>
      (await extrairTextoPorPagina(await gerarPdfDoArtefato(conteudo, fontes))).map(umaLinha).join(' ')
    expect(await rodape(comFonte())).toContain(`Fonte: ${TITULO_DO_MATERIAL}, p. 2`)
    expect(await rodape(comFonte({ edicao: '2025' }))).toContain(`Fonte: ${TITULO_DO_MATERIAL} (2025), p. 2`)
    expect(await rodape(comFonte({ edicao: '2024', substituido: true }))).toContain(`Fonte: ${TITULO_DO_MATERIAL} (2024, edição anterior), p. 2`)
    expect(await rodape(comFonte({ substituido: true }))).toContain(`Fonte: ${TITULO_DO_MATERIAL} (edição anterior), p. 2`)
    // A lista de fontes do plano usa o mesmo texto.
    const citacao = { materialId: MATERIAL, pagina: 3, trecho: 'A proporção em mol é dada pelos coeficientes.' }
    const plano: ConteudoDePlanoDeAula = {
      tipo: 'plano_de_aula',
      titulo: 'Plano',
      duracaoMinutos: 50,
      objetivos: ['Explicar a proporção.'],
      habilidades: [{ codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante.' }],
      etapas: [{ titulo: 'Abertura', minutos: 10, descricao: 'Pergunte à turma.', citacao }],
      avaliacao: 'Atividade curta.',
      citacoes: [citacao],
    }
    const doPlano = await rodape(comFonte({ edicao: '2024', substituido: true }), plano)
    expect(doPlano).toContain(`Fonte: ${TITULO_DO_MATERIAL} (2024, edição anterior), p. 3`)
    expect(doPlano).toContain(`• ${TITULO_DO_MATERIAL} (2024, edição anterior), p. 3`)
  })

  it('não tem de onde tirar nome de pessoa nem de turma: só o conteúdo e o título do material entram, e os metadados do arquivo não levam autor', async () => {
    const bytes = await gerarPdfDoArtefato(atividade(2), TITULOS)
    const cru = bytes.toString('latin1')
    expect(cru).not.toMatch(/\/Author/u)
    expect(cru).toContain('(Turmma)')
    const texto = (await extrairTextoPorPagina(bytes)).map(umaLinha).join(' ')
    expect(texto).not.toMatch(/Professor[a]?:|Turma:|Aluno[a]?:|Nome:/u)
    // Material fora do mapa (de outra escola, ou eliminado) não ganha título inventado.
    const semTitulo = (await extrairTextoPorPagina(await gerarPdfDoArtefato(atividade(1), new Map()))).map(umaLinha).join(' ')
    expect(semTitulo).toContain('Fonte: material da escola, p. 2')
  })

  it('a versão adaptada sai com a fonte ampliada, e os tipos de adaptação aparecem só na página do gabarito', async () => {
    const original = atividade(12)
    const adaptada: ConteudoDeAtividade = { ...original, titulo: 'Atividade — estequiometria (versão adaptada)', adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 } }
    const paginasDoOriginal = await extrairTextoPorPagina(await gerarPdfDoArtefato(original, TITULOS))
    const paginas = (await extrairTextoPorPagina(await gerarPdfDoArtefato(adaptada, TITULOS))).map(umaLinha)
    expect(paginas.length).toBeGreaterThan(paginasDoOriginal.length)
    expect(paginas.at(-1)).toContain('Versão adaptada: Fonte ampliada, Tempo adicional (+25%).')
    expect(paginas.slice(0, -1).join(' ')).not.toMatch(/Fonte ampliada|Tempo adicional/u)
  })

  it('o rascunho leva a marca em toda página, inclusive nas que a quebra criou e na do gabarito, e não diz que foi revisado', async () => {
    const adaptada: ConteudoDeAtividade = { ...atividade(12), adaptacao: { tipos: ['fonte_ampliada'] } }
    const paginas = (await extrairTextoPorPagina(await gerarPdfDoArtefato(adaptada, TITULOS, { rascunho: true }))).map(umaLinha)
    const limpas = (await extrairTextoPorPagina(await gerarPdfDoArtefato(adaptada, TITULOS))).map(umaLinha)
    // A marca fica fora do fluxo do texto: não cria página nem empurra questão.
    expect(paginas.length).toBe(limpas.length)
    expect(paginas.length).toBeGreaterThan(3)
    for (const pagina of paginas) expect(pagina).toContain(MARCA_DE_RASCUNHO)
    expect(paginas.join(' ')).toContain(umaLinha(AVISO_DE_IA_NO_RASCUNHO))
    expect(paginas.join(' ')).not.toContain('revisado')
    expect(paginas.join(' ')).toContain('12. Segundo o material')
    // Sem a opção, nada de rascunho, e o aviso é o de quem revisou.
    expect(limpas.join(' ')).not.toContain('Rascunho')
    expect(limpas.join(' ')).toContain(umaLinha(AVISO_DE_IA_NO_PDF))
    expect(AVISO_DE_IA_NO_RASCUNHO).not.toMatch(/revisad/u)
  })

  it('o rascunho com a fonte de "edição anterior": a marca em toda página e o rodapé novo aparecem no mesmo PDF, sem um esconder o outro', async () => {
    const fontes = comFonte({ edicao: '2024', substituido: true })
    const paginas = (await extrairTextoPorPagina(await gerarPdfDoArtefato(atividade(12), fontes, { rascunho: true }))).map(umaLinha)
    for (const pagina of paginas) expect(pagina).toContain(MARCA_DE_RASCUNHO)
    const todas = paginas.join(' ')
    expect(todas).toContain(`Fonte: ${TITULO_DO_MATERIAL} (2024, edição anterior), p. 2`)
    expect(todas).toContain(umaLinha(AVISO_DE_IA_NO_RASCUNHO))
    expect(todas).not.toContain('revisado')
  })

  it('o plano de aula sai com a duração, os objetivos, as etapas com a página de origem, a avaliação e as fontes', async () => {
    const citacao = { materialId: MATERIAL, pagina: 3, trecho: 'O reagente limitante é o que acaba primeiro.' }
    const plano: ConteudoDePlanoDeAula = {
      tipo: 'plano_de_aula',
      titulo: 'Plano de aula — reagente limitante',
      objetivos: ['Explicar o conceito de reagente limitante.'],
      habilidades: [{ codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' }],
      duracaoMinutos: 50,
      etapas: [
        { titulo: 'Abertura', minutos: 10, descricao: 'Pergunte à turma o que ela entende por reagente limitante.', citacao },
        { titulo: 'Prática em duplas', minutos: 40, descricao: 'Em duplas, os alunos resolvem N₂ + 3 H₂ → 2 NH₃.', citacao: { ...citacao, pagina: 4 } },
      ],
      avaliacao: 'Atividade objetiva curta no fim da aula.',
      citacoes: [citacao, { ...citacao, pagina: 4 }],
    }
    const texto = (await extrairTextoPorPagina(await gerarPdfDoArtefato(plano, TITULOS))).map(umaLinha).join(' ')
    for (const trecho of [
      'Plano de aula — reagente limitante',
      umaLinha(AVISO_DE_IA_NO_PDF),
      'Duração: 50 minutos',
      'Explicar o conceito de reagente limitante.',
      'QUI.EM.05 — Identificar o reagente limitante e o reagente em excesso.',
      '1. Abertura (10 min)',
      '2. Prática em duplas (40 min)',
      'N2 + 3 H2 -> 2 NH3',
      'Fonte: Química 2 — Capítulo 7: Estequiometria, p. 4',
      'Atividade objetiva curta no fim da aula.',
      'Química 2 — Capítulo 7: Estequiometria, p. 3',
    ]) {
      expect(texto).toContain(trecho)
    }
  })
})
