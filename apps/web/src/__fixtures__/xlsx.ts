/**
 * Monta um arquivo XLSX de verdade, só para os testes (F2, 13.0): um zip sem compressão com as seis partes mínimas de uma pasta de
 * trabalho do Excel. Existe para a leitura passar pela biblioteca real (`read-excel-file`) e não por um duplo dela: a premissa da
 * Tech Spec, seção 12, é justamente que a célula de texto chega como texto. Não entra em nenhuma tela.
 *
 * Célula de texto vai como cadeia compartilhada (`t="s"`, como o Excel grava); célula numérica, como número (`<v>`); data, como
 * número de série com o formato de data do estilo. `null` é a célula em branco.
 */

export type CelulaDeTeste = string | number | Date | null

const CODIFICADOR = new TextEncoder()

/** A tabela do CRC-32 do zip (polinômio 0xEDB88320). */
const TABELA_DO_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (TABELA_DO_CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const escapar = (texto: string): string => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A letra da coluna: 0 → A, 25 → Z, 26 → AA. */
function letraDaColuna(indice: number): string {
  let resto = indice
  let letra = ''
  do {
    letra = String.fromCharCode(65 + (resto % 26)) + letra
    resto = Math.floor(resto / 26) - 1
  } while (resto >= 0)
  return letra
}

/** O número de série de uma data no Excel (dias desde 30/12/1899), pelo dia em UTC. */
const serieDaData = (data: Date): number => Math.round(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) / 86_400_000) + 25_569

function planilhaEmXml(linhas: readonly (readonly CelulaDeTeste[])[], textos: string[]): string {
  const indiceDoTexto = (texto: string): number => {
    const achado = textos.indexOf(texto)
    if (achado !== -1) return achado
    textos.push(texto)
    return textos.length - 1
  }
  const corpo = linhas
    .map((linha, posicaoDaLinha) => {
      const celulas = linha
        .map((celula, posicaoDaColuna) => {
          const referencia = `${letraDaColuna(posicaoDaColuna)}${String(posicaoDaLinha + 1)}`
          if (celula === null) return ''
          if (typeof celula === 'string') return `<c r="${referencia}" t="s"><v>${String(indiceDoTexto(celula))}</v></c>`
          if (typeof celula === 'number') return `<c r="${referencia}"><v>${String(celula)}</v></c>`
          return `<c r="${referencia}" s="1"><v>${String(serieDaData(celula))}</v></c>`
        })
        .join('')
      return `<row r="${String(posicaoDaLinha + 1)}">${celulas}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${corpo}</sheetData></worksheet>`
}

const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

/** Um arquivo no zip, sem compressão. */
interface Parte {
  readonly nome: string
  readonly dados: Uint8Array
}

function zipSemCompressao(partes: readonly Parte[]): Uint8Array<ArrayBuffer> {
  const locais: Uint8Array[] = []
  const centrais: Uint8Array[] = []
  let deslocamento = 0
  for (const { nome, dados } of partes) {
    const nomeEmBytes = CODIFICADOR.encode(nome)
    const crc = crc32(dados)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, dados.length, true)
    local.setUint32(22, dados.length, true)
    local.setUint16(26, nomeEmBytes.length, true)
    locais.push(new Uint8Array(local.buffer), nomeEmBytes, dados)
    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, dados.length, true)
    central.setUint32(24, dados.length, true)
    central.setUint16(28, nomeEmBytes.length, true)
    central.setUint32(42, deslocamento, true)
    centrais.push(new Uint8Array(central.buffer), nomeEmBytes)
    deslocamento += 30 + nomeEmBytes.length + dados.length
  }
  const tamanhoDoCentral = centrais.reduce((soma, parte) => soma + parte.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, partes.length, true)
  fim.setUint16(10, partes.length, true)
  fim.setUint32(12, tamanhoDoCentral, true)
  fim.setUint32(16, deslocamento, true)
  const todas = [...locais, ...centrais, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(todas.reduce((soma, parte) => soma + parte.length, 0))
  let posicao = 0
  for (const parte of todas) {
    saida.set(parte, posicao)
    posicao += parte.length
  }
  return saida
}

/** As linhas viram a primeira (e única) aba de um XLSX. */
export function montarXlsx(linhas: readonly (readonly CelulaDeTeste[])[], nomeDaAba = 'Alunos'): Uint8Array<ArrayBuffer> {
  const textos: string[] = []
  const planilha = planilhaEmXml(linhas, textos)
  const compartilhadas = `${CABECALHO_XML}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${String(textos.length)}" uniqueCount="${String(textos.length)}">${textos
    .map((texto) => `<si><t xml:space="preserve">${escapar(texto)}</t></si>`)
    .join('')}</sst>`
  const estilos = `${CABECALHO_XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`
  const partes: Parte[] = [
    {
      nome: '[Content_Types].xml',
      dados: CODIFICADOR.encode(
        `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      nome: '_rels/.rels',
      dados: CODIFICADOR.encode(
        `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      nome: 'xl/workbook.xml',
      dados: CODIFICADOR.encode(
        `${CABECALHO_XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapar(nomeDaAba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      dados: CODIFICADOR.encode(
        `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { nome: 'xl/worksheets/sheet1.xml', dados: CODIFICADOR.encode(planilha) },
    { nome: 'xl/sharedStrings.xml', dados: CODIFICADOR.encode(compartilhadas) },
    { nome: 'xl/styles.xml', dados: CODIFICADOR.encode(estilos) },
  ]
  return zipSemCompressao(partes)
}
