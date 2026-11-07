import { diaDeUso, FUSO_DO_USO, SemanaRepository, systemClock, type Clock, type Database } from '@educa/core'
import { semanaResponseSchema, type SemanaQuery, type SemanaResponse } from '@educa/shared'
import { montarDias, somarDias } from './montar-dias.js'

const formatadorDaHora = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_DO_USO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** `HH:MM` do instante no fuso da escola. */
function horaDeUso(instante: Date): string {
  return formatadorDaHora.format(instante)
}

/**
 * A Semana da professora (F2b, tarefa 2.0; Tech Spec da semana-do-professor, seções 4 e 5): as aulas dos vínculos `confirmado` dela, no ano em
 * curso da escola do token, sem feriado e recesso, com o registro de texto e o que saiu da grade. Escola e professora vêm do contexto e da sessão;
 * a consulta só diz qual semana. Sem ano em curso responde `ano: null` e nenhum dia (e não `NAO_ENCONTRADO`). `hoje` e `agora` são do fuso da
 * escola, lidos do relógio que o teste injeta. Os itens do dia (a atividade aplicada, a encerrada e a correção do Assistente) vêm do repository.
 */
export class SemanaService {
  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  async ler(consulta: SemanaQuery): Promise<SemanaResponse> {
    const instante = this.relogio.agora()
    const hoje = diaDeUso(instante)
    const agora = horaDeUso(instante)
    const repositorio = new SemanaRepository(this.banco)

    const ano = await repositorio.anoEmCurso()
    if (ano === null) return semanaResponseSchema.parse({ ano: null, hoje, agora, gradeImportada: false, calendarioImportado: false, dias: [] })

    const domingo = somarDias(consulta.segunda, 6)
    const vinculos = await repositorio.vinculosDaProfessora(ano.id)
    const ids = vinculos.map((vinculo) => vinculo.id)
    // Em sequência, e não em `Promise.all`: a rota abre com a rajada das 7h30, e cada requisição segura uma conexão do pool por vez, não cinco.
    const alocacoes = await repositorio.alocacoesDosVinculos(ano.id, ids)
    const eventos = await repositorio.eventosDaSemana(ano.id, consulta.segunda, domingo)
    const registros = await repositorio.registrosDosVinculos(ano.id, ids, consulta.segunda, domingo)
    const gradeImportada = await repositorio.gradeImportada(ano.id)
    const calendarioImportado = await repositorio.calendarioImportado(ano.id)
    const itens = await repositorio.itensDaSemana(ano.id, consulta.segunda, domingo)
    const dias = montarDias({ segunda: consulta.segunda, ano, hoje, vinculos, alocacoes, eventos, registros, itens })
    return semanaResponseSchema.parse({ ano: { inicio: ano.inicio, fim: ano.fim }, hoje, agora, gradeImportada, calendarioImportado, dias })
  }
}
