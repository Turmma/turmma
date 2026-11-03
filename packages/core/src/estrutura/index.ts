// O subcaminho `@educa/core/estrutura` (onboarding-por-convite, tarefa 1.0): os repositories da estrutura da escola e da
// decisão do pedido de nome, que subiram de `apps/api` por mudança de lugar, para a API e o worker gravarem pelo mesmo
// caminho. Nem a `ContaGlobalRepository` nem o `contaDoProfessor` saem por aqui: o cadastro do professor, que acha ou cria
// a conta global pelo e-mail, tem o subcaminho próprio `@educa/core/cadastro-de-professor`, e quem o chama está cercado nas
// duas guardas (regra 10, item 9). Um `export` dele neste barril o deixaria ao alcance de todo módulo que importa a estrutura.
export { DecisaoRepository } from './decisao.repository.js'
export type { AlcanceDoPedido, NomeDoPedido, PedidoPendente, PedidoTravado } from './decisao.repository.js'
export { DisciplinaRepository } from './disciplina.repository.js'
export { ListaRepository } from './lista.repository.js'
export type { MatriculaNaLista, NomeNovo } from './lista.repository.js'
export { SerieRepository } from './serie.repository.js'
export { TurmaRepository } from './turma.repository.js'
export type { AlcanceDaTurma, NovaTurma, TurmaGravada } from './turma.repository.js'
export { VinculoRepository } from './vinculo.repository.js'
export type { Decisao, NovoVinculo, VinculoLido } from './vinculo.repository.js'
