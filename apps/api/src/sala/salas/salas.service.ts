import { DomainException, type Database } from '@educa/core'
import { ErrorCode, salaAbertaResponseSchema, type AbrirSalaRequest, type SalaAbertaResponse } from '@educa/shared'
import type { AcessoDaSala, CodigoRateLimit } from '../../sessao/index.js'
import { entradaDaSala } from '../entrada-da-sala.js'
import { ListaLivreRepository } from '../reivindicacao/lista-livre.repository.js'

/**
 * A página pública da sala (A1, tarefa 5.0, RF10; Tech Spec da A1, seções 4, 6 e 7): sem login, o aluno abre a turma
 * pelo link ou pelo código e vê o nome dela e os nomes livres da lista. A escola, o ano e a turma saem do acesso vigente
 * que o `AcessoDaSala` achou pelo slug e pelo hash do token ou o HMAC do código: nada vem do cliente, e nada disto lê
 * sessão, cookie nem grava registro de acesso (A6), para o pedido não ficar ligado ao IP.
 *
 * O que não é um acesso vigente da escola do slug no ano em curso responde o mesmo `NAO_ENCONTRADO`. Nada disto loga: o
 * slug, o token, o código e os nomes nunca vão a log.
 *
 * Pelo código, a `guarda` (os limites da sala, 7.0) conta o código errado na escola do slug e, acima do teto, faz a
 * busca esperar 1 s: quem tenta códigos para listar os nomes livres anda devagar, e o código certo continua abrindo.
 */
export class SalasService {
  constructor(
    private readonly banco: Database,
    private readonly acessoDaSala: AcessoDaSala,
    private readonly chaveCodigo: Uint8Array,
    private readonly guarda: CodigoRateLimit,
  ) {}

  /** `POST /v1/salas/abrir`: o nome da turma e os nomes livres, lidos a cada abertura. */
  async abrir(pedido: AbrirSalaRequest): Promise<SalaAbertaResponse> {
    return this.acessoDaSala.naSala(entradaDaSala(pedido, this.chaveCodigo), async ({ turmaId }) => {
      const lista = new ListaLivreRepository(this.banco)
      const nomeDaTurma = await lista.nomeDaTurma(turmaId)
      // A turma excluída leva o acesso pela cascata: sem ela aqui, a exclusão chegou entre as duas leituras.
      if (nomeDaTurma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return salaAbertaResponseSchema.parse({ turma: { nome: nomeDaTurma }, nomes: await lista.nomesLivres(turmaId) })
    }, this.guarda)
  }
}
