// A tabela "caminho → inventário" do portão da tarefa. Inventário é o teste que enumera tudo o que existe de um tipo e quebra com
// um acréscimo (`executar-task`, "Quem usa o que mudou"). O portão só roda os testes que o diff alterou, e o inventário não está
// entre eles: na F4, a FK do catálogo (duas vezes, na 5.0) e o compose só apareceram na esteira (retro da F4, M2).
// Função pura, sem ler a árvore: o teste confere que cada inventário existe.

export interface InventarioDoPortao {
  /** Diz se o arquivo alterado é do que o inventário enumera. */
  toca: (arquivo: string) => boolean
  /** O teste de integração que o portão passa a rodar quando o diff toca o inventariado. */
  inventario: string
}

export const INVENTARIOS_DO_PORTAO: readonly InventarioDoPortao[] = [
  // Migration, o diário e os snapshots dela: o inventário das tabelas confere FK, `escola_id` e as listas fechadas do banco.
  { toca: (arquivo) => arquivo.startsWith('packages/core/drizzle/'), inventario: 'packages/core/src/db/schema/mvp/mvp-tables.int.test.ts' },
  // Só o compose do ambiente: o `compose.carga.yml` é outro arquivo e outro conjunto de serviços.
  { toca: (arquivo) => arquivo === 'infra/compose.yml', inventario: 'tools/ci/compose.int.test.ts' },
]

/** Os inventários que o diff alcança, sem repetir e na ordem da tabela. */
export function inventariosDosAlterados(arquivos: readonly string[]): string[] {
  return INVENTARIOS_DO_PORTAO.filter((linha) => arquivos.some(linha.toca)).map((linha) => linha.inventario)
}
