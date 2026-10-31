/**
 * Os endereços da área do operador Turmma (A0), relativos à base `/operacao`: as rotas daqui vivem num `Route` aninhado
 * (`nest`), e é por isso que `/entrar` aqui é `/operacao/entrar` no navegador. Para sair da área, o caminho começa por
 * `~`, a raiz do wouter.
 */
export const BASE_DA_OPERACAO = '/operacao'

export const ROTAS_DA_OPERACAO = {
  /** A casca da operação, com a sessão aberta: a tela Escolas. */
  inicio: '/',
  /** O uso de infra por escola (A0b, tarefa 8.0), com a página e a ordem na query string. */
  uso: '/uso',
  /** O link do `ops:operador convite`, com o token no `#`, que a tela tira da barra antes de qualquer chamada. */
  convite: '/convite',
  entrar: '/entrar',
  /** O código do aplicativo ou de recuperação, com o desafio `mfa` em memória. */
  mfa: '/mfa',
  /** Configurar o segundo fator, com o desafio `configurar_mfa` do aceite do convite ou da entrada por e-mail. */
  configurarMfa: '/mfa/configurar',
} as const

/**
 * A casca pelo caminho absoluto (`~` é a raiz do wouter): navegar para `/` dentro da área daria `/operacao/`, com a
 * barra no fim, e o endereço da casca é um só.
 */
export const INICIO_DA_OPERACAO = `~${BASE_DA_OPERACAO}`

/** A tela Uso pelo caminho absoluto, como `INICIO_DA_OPERACAO`: é o link da navegação e o destino da troca de página. */
export const USO_DA_OPERACAO = `~${BASE_DA_OPERACAO}${ROTAS_DA_OPERACAO.uso}`
