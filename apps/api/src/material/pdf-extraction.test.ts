import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { linhasDoBloco, normalizarTexto, paginaDoMaterial, PAGINAS_DO_MATERIAL, rodapeDaPagina } from '../../../../tools/demonstracao/conteudo-estequiometria.ts'
import { CAMINHO_DO_MATERIAL } from '../../../../tools/demonstracao/gerar-material.ts'
import { PdfExtractor, MAXIMO_DE_CARACTERES_DO_TRECHO, temAssinaturaDePdf, tirarLinhasRepetidas } from './pdf-extraction.js'

const extrator = new PdfExtractor()
const demonstracao = (): Uint8Array => new Uint8Array(readFileSync(CAMINHO_DO_MATERIAL))

/** Um PDF de verdade, com uma página e nenhum texto: é o que um scanner entrega sem OCR, menos a imagem. */
export const PDF_SEM_TEXTO = Buffer.from(
  ['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>', '%%EOF', ''].join('\n'),
  'latin1',
)

/** O conteúdo da página como o material o escreve, **sem** o rodapé corrido. */
const conteudoDaPagina = (numero: number): string => normalizarTexto(paginaDoMaterial(numero).blocos.flatMap(linhasDoBloco).join('\n'))

describe('extração do PDF por página', () => {
  it('o material de demonstração vira seis trechos, um por página, com o texto inteiro de cada uma e sem o rodapé corrido', async () => {
    const resultado = await extrator.extrair(demonstracao())
    if (resultado.falha !== null) throw new Error(`a extração falhou: ${resultado.falha}`)

    expect(resultado.paginas).toBe(6)
    expect(resultado.trechos.map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
    for (const { numero } of PAGINAS_DO_MATERIAL) {
      const texto = resultado.trechos[numero - 1]?.texto ?? ''
      // Fiel à página: tudo o que o conteúdo escreve nela, na ordem, e nada do rodapé.
      expect(normalizarTexto(texto), `página ${String(numero)}`).toBe(conteudoDaPagina(numero))
      expect(texto).not.toContain(rodapeDaPagina(numero))
      expect(texto).not.toContain('Material de demonstração Turmma · p.')
    }
    expect(normalizarTexto(resultado.trechos[3]?.texto ?? '')).toContain('Reagente limitante é o reagente que acaba primeiro')
  })

  it('a extração não esvazia nem altera os bytes que recebeu: o mesmo arquivo extrai duas vezes igual', async () => {
    const bytes = demonstracao()
    const copia = Buffer.from(bytes)
    const primeira = await extrator.extrair(bytes)
    expect(Buffer.from(bytes).equals(copia)).toBe(true)
    expect(await extrator.extrair(bytes)).toEqual(primeira)
  })

  it('arquivo que não é PDF, mesmo com nome de PDF, sai `arquivo_invalido` sem chegar à biblioteca', async () => {
    expect(await extrator.extrair(new TextEncoder().encode('nome,matricula\nAluno sintético,123'))).toEqual({ falha: 'arquivo_invalido' })
    expect(await extrator.extrair(new Uint8Array())).toEqual({ falha: 'arquivo_invalido' })
  })

  it('arquivo com a assinatura de PDF e o resto corrompido sai `arquivo_invalido`, e nunca a mensagem da biblioteca', async () => {
    const corrompido = Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.alloc(4096, 0x41)])
    expect(await extrator.extrair(new Uint8Array(corrompido))).toEqual({ falha: 'arquivo_invalido' })
    // O PDF de demonstração cortado no meio: o que um envio interrompido deixaria.
    const truncado = demonstracao().subarray(0, 600)
    expect(await extrator.extrair(truncado)).toEqual({ falha: 'arquivo_invalido' })
  })

  it('PDF que abre e não tem texto (só imagem) sai `sem_texto`', async () => {
    expect(await extrator.extrair(new Uint8Array(PDF_SEM_TEXTO))).toEqual({ falha: 'sem_texto' })
  })

  it('com o prazo já vencido, nada é lido e sai `extracao_falhou`', async () => {
    expect(await extrator.extrair(demonstracao(), AbortSignal.abort())).toEqual({ falha: 'extracao_falhou' })
  })

  it('a assinatura é conferida no conteúdo, nos primeiros 1024 bytes', () => {
    expect(temAssinaturaDePdf(demonstracao())).toBe(true)
    expect(temAssinaturaDePdf(Buffer.concat([Buffer.alloc(100, 0x20), Buffer.from('%PDF-1.4')]))).toBe(true)
    expect(temAssinaturaDePdf(Buffer.concat([Buffer.alloc(2000, 0x20), Buffer.from('%PDF-1.4')]))).toBe(false)
    expect(temAssinaturaDePdf(Buffer.from('PK\u0003\u0004 planilha.pdf'))).toBe(false)
  })

  it('o teto do trecho é o da coluna `trecho.texto`', () => {
    expect(MAXIMO_DE_CARACTERES_DO_TRECHO).toBe(20_000)
  })
})

describe('linha que se repete em todas as páginas (cabeçalho e rodapé corridos)', () => {
  const pagina = (numero: number, ...conteudo: string[]): string[] => [...conteudo, `Química 2 · Capítulo 7 · p. ${String(numero)}`]

  it('tira a última linha que se repete em todas as páginas mudando só o número, e deixa o resto como está', () => {
    const paginas = [pagina(1, 'Mol é a unidade.'), pagina(2, 'Massa molar da água: 18 g/mol.'), pagina(10, 'Reagente limitante acaba primeiro.')]
    expect(tirarLinhasRepetidas(paginas)).toEqual([['Mol é a unidade.'], ['Massa molar da água: 18 g/mol.'], ['Reagente limitante acaba primeiro.']])
  })

  it('tira também o cabeçalho corrido, e a linha só com o número da página', () => {
    const paginas = [1, 2, 3].map((numero) => ['Colégio sintético — Química', `conteúdo ${'x'.repeat(numero)}`, String(numero)])
    expect(tirarLinhasRepetidas(paginas)).toEqual([['conteúdo x'], ['conteúdo xx'], ['conteúdo xxx']])
  })

  it('não tira nada se uma página com texto não tem a linha: a capa sem rodapé mantém o rodapé das outras', () => {
    const paginas = [['Capa do capítulo'], pagina(2, 'a'), pagina(3, 'b')]
    expect(tirarLinhasRepetidas(paginas)).toEqual(paginas)
  })

  it('não tira nada se a linha muda em outra coisa que não o número', () => {
    const paginas = [['a', 'Capítulo 7 · Estequiometria · p. 1'], ['b', 'Capítulo 7 · Estequiometria · p. 2'], ['c', 'Capítulo 8 · Soluções · p. 3']]
    expect(tirarLinhasRepetidas(paginas)).toEqual(paginas)
  })

  it('com menos de três páginas com texto, "se repete em todas" não quer dizer nada: fica tudo', () => {
    const paginas = [pagina(1, 'a'), pagina(2, 'b'), []]
    expect(tirarLinhasRepetidas(paginas)).toEqual(paginas)
  })

  it('a página em branco no meio não impede: conta só a página com texto', () => {
    expect(tirarLinhasRepetidas([pagina(1, 'a'), [], pagina(3, 'b'), pagina(4, 'c')])).toEqual([['a'], [], ['b'], ['c']])
  })

  it('tira no máximo duas linhas de cada borda: o texto igual em todas as páginas além disso é conteúdo', () => {
    const paginas = [1, 2, 3].map(() => ['igual', 'igual', 'igual', 'igual', 'igual'])
    expect(tirarLinhasRepetidas(paginas)).toEqual([['igual'], ['igual'], ['igual']])
  })
})
