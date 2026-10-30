import { especificador } from './regras-ia.mjs'
import { TABELAS_DO_NUCLEO } from './tabelas-do-nucleo.mjs'

/**
 * Guarda de tenant (regra 00, item 3; regra 10, item 3): tabela do schema só no repository, que é onde o escopo da escola é
 * aplicado a partir do token. Service, controller, worker ou script que importa a tabela do `@educa/nucleo` monta a query
 * solta, e é assim que o isolamento acaba furado.
 *
 * A guarda não segue valor. Fora das exceções de `index.mjs` (`*.repository.ts`, teste, `packages/nucleo/src/db/**` e este
 * arquivo, que nomeia o pacote que procura), do núcleo só se importa pelo nome o que não leva tabela. Reprova:
 * - importar ou reexportar pelo nome, com ou sem apelido e também como `type`, uma tabela de `tabelas-do-nucleo.mjs`, o
 *   objeto `schema` e o tipo `Schema` (todas as tabelas) ou o `default` (o módulo inteiro, onde houver interop);
 * - `import * as` e o import padrão do pacote, que trazem o módulo inteiro;
 * - o texto do pacote, ou de um subcaminho dele, em qualquer outro ponto do código: `import()`, `typeof import()`,
 *   `import … = require()`, `export *`, e qualquer chamada, `new`, template com tag, afirmação de tipo, condicional,
 *   sequência ou array em volta dele. Só a fonte de `import … from` e de `export { … } from` passa, porque ali quem
 *   decide é o nome importado.
 * Como nenhum nome que leva tabela entra no arquivo, não há namespace nem objeto para seguir até o membro.
 *
 * Limites declarados, o que uma guarda que lê um arquivo por vez não vê:
 * - o pacote que não está escrito como um texto só: guardado em variável (`import(nome)`), montado
 *   (`'@educa/' + 'nucleo'`, `` `@educa/${x}` ``) ou só num comentário (o `import()` de um JSDoc, que é tipo e não
 *   carrega o módulo); e o caminho relativo ou absoluto até o arquivo da tabela (`../db/schema/escola`). Os caminhos
 *   estáticos são das camadas (12.0, depcruise);
 * - a tabela que sai por um arquivo de exceção (o repository ou o `db/**` que a reexporta) e o arquivo que a importa
 *   dele: seguir o nome de um arquivo para outro é análise entre arquivos, e o `tenancy-guardian` audita todo repository;
 * - o `Database` injetado em service ou controller alcança tabela sem import nenhum, pela consulta relacional
 *   (`banco.query.turma.findMany()`) ou por SQL cru: impedir que o `Database` chegue lá é das camadas (12.0).
 */

const PACOTE = '@educa/nucleo'

/** O que, importado pelo nome, leva tabela. */
const NOMES_QUE_LEVAM_TABELA = new Set([
  ...TABELAS_DO_NUCLEO,
  // o objeto com todas as tabelas (`packages/nucleo/src/db/banco.ts`)
  'schema',
  // o módulo inteiro, onde houver interop com CommonJS
  'default',
  // o tipo de todas as tabelas
  'Schema',
])

export const MENSAGEM_TABELA_FORA_DO_REPOSITORY =
  'Do @educa/nucleo, fora de *.repository.ts, de teste e de packages/nucleo/src/db, só se importa pelo nome o que não é tabela: a tabela, o schema e o módulo inteiro (import * as, export *, import(), require, o nome do pacote como texto) ficam no repository, onde o escopo de tenant é aplicado (regra 00, item 3; regra 10, item 3).'

/** O pacote ou um subcaminho dele (`@educa/nucleo/ciclo-de-vida`), escrito como texto; `@educa/nucleo-legado` é outro pacote. */
const ehDoNucleo = (fonte) => {
  const modulo = especificador(fonte)
  return modulo === PACOTE || (modulo?.startsWith(`${PACOTE}/`) ?? false)
}

/** A fonte de `import … from` e de `export { … } from`, que o nome importado decide. */
const ehFonteDeImportPeloNome = (no) => no.parent.type === 'ImportDeclaration' || no.parent.type === 'ExportNamedDeclaration'

/** `escola`, ou `'escola'` em `import { 'escola' as e }`. */
const nomeEscrito = (no) => (no.type === 'Literal' ? no.value : no.name)

export const tabelaSoNoRepository = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Proíbe trazer de @educa/nucleo, fora de *.repository.ts, uma tabela do schema, o schema ou o módulo inteiro, e o nome do pacote como texto (regra 00, item 3).',
    },
    schema: [],
    messages: { tabela: MENSAGEM_TABELA_FORA_DO_REPOSITORY },
  },
  create(context) {
    const denunciar = (no) => context.report({ node: no, messageId: 'tabela' })
    return {
      // `import { escola }`, `{ escola as e }`, `{ 'escola' as e }`, `type`, `{ schema }` e `{ default as x }`; e
      // `import * as` e o import padrão, que trazem o módulo inteiro
      ImportDeclaration(no) {
        if (!ehDoNucleo(no.source)) return
        for (const importado of no.specifiers) {
          if (importado.type !== 'ImportSpecifier' || NOMES_QUE_LEVAM_TABELA.has(nomeEscrito(importado.imported))) denunciar(importado)
        }
      },
      // `export { escola } from …`, `export { schema as s } from …` e `export type { … } from …`
      ExportNamedDeclaration(no) {
        if (!ehDoNucleo(no.source)) return
        for (const reexportado of no.specifiers) if (NOMES_QUE_LEVAM_TABELA.has(nomeEscrito(reexportado.local))) denunciar(reexportado)
      },
      // O texto do pacote em qualquer outro lugar do código: `import()`, `typeof import()`, `import … = require()`, `export *`, e
      // qualquer chamada, `new`, afirmação de tipo, condicional, sequência ou array em volta dele
      Literal(no) {
        if (!ehFonteDeImportPeloNome(no) && ehDoNucleo(no)) denunciar(no)
      },
      TemplateLiteral(no) {
        if (ehDoNucleo(no)) denunciar(no)
      },
    }
  },
}
