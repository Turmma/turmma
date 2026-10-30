import { requireEscolaId, registroAcesso, type Database, type EventoDeAcesso, type DatabaseTransaction } from '@educa/nucleo'

/**
 * O registro de acesso (Marco Civil, art. 15) de quem já tem escola: login, renovação e saída, gravados na escola do
 * contexto, nunca na de um argumento (regra 10, item 3). A falha por e-mail, antes de haver escola, é a única exceção
 * e fica na resolução de tenant (em `sessao/`). A falha por matrícula (11.0) já tem a escola do slug, e fica aqui.
 *
 * Grava só evento, usuário, IP e hora: nada de e-mail, cookie ou navegador (`docs/lgpd.md`).
 */
export class RegistroDeAcessoRepository {
  constructor(private readonly tx: Database | DatabaseTransaction) {}

  async gravar(evento: Exclude<EventoDeAcesso, 'login_falho'>, usuarioId: string, ip: string): Promise<void> {
    await this.tx.insert(registroAcesso).values({ escolaId: requireEscolaId(), usuarioId, evento, ip })
  }

  /**
   * A falha de login por matrícula, na escola do slug: sem usuário, como a falha por e-mail, para a linha não dizer
   * se a matrícula existe.
   */
  async gravarFalha(ip: string): Promise<void> {
    await this.tx.insert(registroAcesso).values({ escolaId: requireEscolaId(), usuarioId: null, evento: 'login_falho', ip })
  }
}
