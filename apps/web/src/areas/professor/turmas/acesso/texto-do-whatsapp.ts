/**
 * O convite da turma para mandar pelo WhatsApp (A1, 15.0; RF9; P27). É só um link de compartilhar: o navegador do
 * professor abre o `wa.me` com o texto, e não há integração, API nem envio feito pelo nosso servidor.
 *
 * O texto é montado **só** por `textoDoWhatsApp`, e ela só recebe o nome da escola e o link: nome de aluno, matrícula e
 * turma não têm por onde entrar (regra 20). O que vai à Meta é o que o professor decide mandar: a escola e o link.
 */

/** O que o texto leva, e mais nada. */
export interface ConviteDaTurma {
  readonly escolaNome: string
  /** O link da sala, com o token no fragmento (`linkDoConvite` com `caminhoDaSala`). */
  readonly link: string
}

/** O texto do convite: a escola, o que o aluno faz, e o link. O link vai numa linha só dele, para o WhatsApp o reconhecer. */
export function textoDoWhatsApp({ escolaNome, link }: ConviteDaTurma): string {
  return `${escolaNome} no Turmma.\nAbra o link, escolha o seu nome na lista da turma, informe a sua matrícula e crie a sua senha:\n${link}`
}

/** O endereço de compartilhar do WhatsApp, com o texto na consulta (Tech Spec da A1, seção 12). */
export function enderecoDoWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

/** O que a janela do navegador precisa ter para abrir o WhatsApp: o `window`, ou o de mentira do teste. */
export interface JanelaQueAbre {
  open(endereco: string, alvo: string): { opener: unknown } | null
}

/**
 * Abre o WhatsApp numa aba nova, com o texto. Devolve se abriu: o navegador que segura a aba nova (o bloqueio de janelas
 * do computador da escola) devolve `null`, e aí quem chama copia o texto. A aba nova não fica com a referência desta
 * (`opener`), que a deixaria trocar o endereço da tela do professor.
 */
export function openWhatsApp(texto: string, janela: JanelaQueAbre): boolean {
  const aberta = janela.open(enderecoDoWhatsApp(texto), '_blank')
  if (aberta === null) return false
  aberta.opener = null
  return true
}
