/**
 * Entrega ao navegador um arquivo que já está num endereço assinado de validade curta (F3, 17.0; RF12): clica num link
 * temporário, como um download comum, e o remove. O nome vai em `download`, para o caso de o endereço ser do mesmo site; no
 * armazém, quem manda o nome é o cabeçalho `Content-Disposition` da própria URL assinada. O endereço nunca vai para o
 * histórico nem para a tela: ele vale 5 minutos e dá o arquivo de uma pessoa (regra 20, item 7).
 *
 * Quem usa a chamada que deu o endereço (`pedirArquivoDaEscola`) é que guarda o registro do download: aqui só se entrega.
 */
export function baixarPorUrl(url: string, nome: string, documento: Document = document): void {
  const ancora = documento.createElement('a')
  ancora.href = url
  ancora.download = nome
  ancora.rel = 'noopener noreferrer'
  ancora.hidden = true
  documento.body.append(ancora)
  ancora.click()
  ancora.remove()
}
