import { TamanhoDaLetra } from '../../components/settings/TamanhoDaLetra'
import { Secao } from '../GallerySection'

/**
 * O tamanho da letra do aluno (tarefa 8.0; mockup 2.5), com a peça que Eu e a introdução (9.0) usam. A galeria não é
 * `/aluno`, então o `data-letra` não vai ao `<html>` aqui: a escolha é só gravada, e a prévia mostra o texto no tamanho do
 * `<html>` de agora. Escolher grava a chave, e só escolher.
 */
export default function SecoesDoTamanhoDaLetra() {
  return (
    <Secao nome="tamanho-da-letra" titulo="Tamanho da letra">
      <div className="max-w-sm">
        <TamanhoDaLetra />
      </div>
    </Secao>
  )
}
