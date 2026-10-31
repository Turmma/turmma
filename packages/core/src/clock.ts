/**
 * De onde o código que decide por horário lê a hora. Em produção é o relógio do sistema; o teste
 * injeta um relógio parado numa terça às 10h, e o avança até as 18h, sem esperar o dia passar.
 */
export interface Clock {
  agora(): Date
}

export const systemClock: Clock = { agora: () => new Date() }
