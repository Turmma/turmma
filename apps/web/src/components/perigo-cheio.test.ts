import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { arquivosQueUsamOPerigoCheio, codigoSemComentarioNemTexto, usaOPerigoCheio } from '../__fixtures__/danger-solid'

/**
 * O `perigo` cheio é o botão `vermelho` que confirma a exclusão, a rejeição ou a recusa, e só existe **dentro de uma
 * confirmação** (RF5 da X1; `docs/interface.md` 10.2; D59: recusar nunca é mais difícil que aceitar, e o botão que não
 * se desfaz não pode aparecer solto numa linha de tabela). Aqui a regra é uma lista fechada: os arquivos de hoje. Um uso
 * novo reprova, e a entrada cujo arquivo já não o escreve também, para a lista só encolher.
 *
 * Os três diálogos de confirmação de hoje são o `ConfirmDialog` (a ação de perigo de toda tela), a
 * `ConfirmacaoDePerigo` de `dialogs.tsx` (excluir, retirar, revogar) e o `DialogoDeDecisao` dos pedidos de nome (recusar).
 * A subtarefa 7.2 da X1 cita os dois primeiros; o terceiro já existia desde a A1 (16.0), é uma confirmação do mesmo jeito
 * e entra na lista com o que ele é. A galeria mostra o desenho do botão, ligado e desligado, e é o único uso fora de
 * confirmação: está na lista com esse motivo, e uma segunda seção que o use reprova do mesmo jeito.
 */
const RAIZ_DA_WEB = join(import.meta.dirname, '..')

/** Quem pode escrever o `perigo` cheio, e por quê. Só encolhe: um sétimo arquivo é decisão de produto, e não de quem edita. */
const USOS_DO_PERIGO_CHEIO: Readonly<Record<string, string>> = {
  'components/ui/button-variants.ts': 'a definição: a constante e a variante `perigo` com `cheio`',
  'components/ui/Button.tsx': 'o tipo da prop `cheio`, que só existe em `variante="perigo"`',
  'components/ui/overlays/ConfirmDialog.tsx': 'o botão que confirma a ação de perigo',
  'components/dialogs.tsx': 'o botão da `ConfirmacaoDePerigo`, que exclui',
  'components/pedidos/DialogoDeDecisao.tsx': 'o botão que recusa os pedidos de nome',
  'gallery/sections/buttons.tsx': 'a galeria mostra o desenho do botão, ligado e desligado: não é tela do produto',
}

describe('o perigo cheio só aparece em confirmação', () => {
  it('os arquivos que o escrevem são os da lista fechada, nem mais nem menos', () => {
    const achados = arquivosQueUsamOPerigoCheio(RAIZ_DA_WEB)
    const novos = achados.filter((arquivo) => !(arquivo in USOS_DO_PERIGO_CHEIO))
    const sumidos = Object.keys(USOS_DO_PERIGO_CHEIO).filter((arquivo) => !achados.includes(arquivo))
    expect(novos, 'o `perigo` cheio só vive dentro de uma confirmação: use `ConfirmDialog` ou `ConfirmacaoDePerigo`').toEqual([])
    expect(sumidos, 'a lista fechada só encolhe, e a entrada cujo arquivo já não escreve o `perigo` cheio sai dela').toEqual([])
  })

  it('a lista fechada tem os seis arquivos de hoje, cada um com o motivo, e não cresce', () => {
    expect(Object.keys(USOS_DO_PERIGO_CHEIO).sort()).toEqual([
      'components/dialogs.tsx',
      'components/pedidos/DialogoDeDecisao.tsx',
      'components/ui/Button.tsx',
      'components/ui/button-variants.ts',
      'components/ui/overlays/ConfirmDialog.tsx',
      'gallery/sections/buttons.tsx',
    ])
    for (const [arquivo, motivo] of Object.entries(USOS_DO_PERIGO_CHEIO)) expect(motivo.length, arquivo).toBeGreaterThan(10)
  })
})

describe('como o arquivo que escreve o perigo cheio é reconhecido', () => {
  it('reconhece a prop do botão, a chave de `classesDoBotao` e a constante', () => {
    expect(usaOPerigoCheio('<Button variante="perigo" cheio onClick={fechar}>Excluir</Button>')).toBe(true)
    expect(usaOPerigoCheio("const classes = buttonVariants({ variante: 'perigo', cheio: true })")).toBe(true)
    expect(usaOPerigoCheio("import { DANGER_SOLID_BUTTON_CLASSES } from './botao-secundario'")).toBe(true)
    expect(usaOPerigoCheio('<Button\n  variante="perigo"\n  cheio\n>')).toBe(true)
    // Com uma seta e um objeto antes da prop, o `>` da seta não fecha a tag.
    expect(usaOPerigoCheio('<Button onClick={() => enviar({ a: 1 })} variante="perigo" cheio>Recusar</Button>')).toBe(true)
  })

  it('não confunde com comentário, com texto entre aspas, com outra variante nem com outra palavra', () => {
    expect(usaOPerigoCheio('/* o fundo cheio é para a faixa */\n<Button variante="perigo">Excluir</Button>')).toBe(false)
    expect(usaOPerigoCheio('// o botão cheio só existe na confirmação\nconst x = 1')).toBe(false)
    expect(usaOPerigoCheio('const texto = "o armazenamento está cheio"')).toBe(false)
    expect(usaOPerigoCheio('<Button variante="perigo" onClick={excluir}>Excluir</Button>')).toBe(false)
    expect(usaOPerigoCheio('const cheioDeAlunos = 3')).toBe(false)
    // O que um comentário ou um texto cita do botão, com a prop dentro, não é o botão.
    expect(usaOPerigoCheio('/* <Button variante="perigo" cheio>Excluir</Button> */\nconst x = 1')).toBe(false)
    expect(usaOPerigoCheio('// <Button variante="perigo" cheio>Excluir</Button>\nconst x = 1')).toBe(false)
    expect(usaOPerigoCheio("const exemplo = '<Button variante=\"perigo\" cheio>'")).toBe(false)
    // A palavra solta, como nome de variável (a sala que encheu), não é o botão.
    expect(usaOPerigoCheio("const [cheio, definirCheio] = useState(false)\nif (desfecho.tipo === 'cheio') definirCheio(true)")).toBe(false)
    // Dentro de um texto com `${ }`, o que está entre as chaves é código, e o resto do texto não.
    expect(usaOPerigoCheio('const c = `${buttonVariants({ variante, cheio })} ${className}`')).toBe(true)
    expect(usaOPerigoCheio('const c = `o sistema está cheio ${nome}`')).toBe(false)
    // O `//` de um endereço não come o resto da linha, e o código depois dele continua sendo lido.
    expect(codigoSemComentarioNemTexto("const u = 'https://exemplo.test'; const c = buttonVariants({ cheio: true })")).toContain('cheio')
  })
})
