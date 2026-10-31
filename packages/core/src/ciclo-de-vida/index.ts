// O subcaminho `@educa/core/ciclo-de-vida` (F3, tarefa 1.0). A `ContaGlobalRepository` não sai por aqui nem pelo
// barrel do pacote: tem subcaminho próprio, e o teste de arquitetura lista quem a importa.
export { CicloDeVidaRepository } from './ciclo-de-vida.repository.js'
export type { UsuarioDoCicloDeVida } from './ciclo-de-vida.repository.js'
export { CicloDeVidaService } from './ciclo-de-vida.service.js'
export type { AutoriaDoCicloDeVida } from './ciclo-de-vida.service.js'
