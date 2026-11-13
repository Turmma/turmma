/** Caractere de controle que o Postgres não guarda em `text` (o NUL) ou que não é texto: vira espaço. */
// eslint-disable-next-line no-control-regex -- é justamente o caractere de controle que se quer tirar.
const CONTROLE = /[\u0000-\u0008\u000B-\u001F\u007F]/g

/** Uma linha com um espaço só entre as palavras, sem caractere de controle e sem espaço nas pontas. */
export const limparLinha = (linha: string): string => linha.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim()

/** Cada linha limpa, e nenhuma linha vazia. */
export const linhasLimpas = (linhas: readonly string[]): string[] => linhas.map(limparLinha).filter((linha) => linha !== '')
