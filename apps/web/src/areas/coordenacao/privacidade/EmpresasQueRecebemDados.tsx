import type { SuboperadorDaEscola } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { consultaSuboperadores } from './api/privacidade'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { Tabela, type ColunaDaTabela } from '../../../components/ui/Tabela'
import { CabecalhoDeSecao } from '../../../components/ui/Tela'
import { textoDaVigencia, textoDasCategorias, textoDoPais, textoDoTreinamento } from './textos-dos-suboperadores'

const COLUNAS: readonly [ColunaDaTabela<SuboperadorDaEscola>, ...ColunaDaTabela<SuboperadorDaEscola>[]] = [
  { chave: 'empresa', titulo: 'Empresa', celula: (linha) => linha.nome },
  { chave: 'finalidade', titulo: 'Para que serve', celula: (linha) => linha.finalidade },
  { chave: 'recebe', titulo: 'O que recebe', celula: (linha) => textoDasCategorias(linha.categorias) },
  { chave: 'pais', titulo: 'Onde processa', celula: (linha) => textoDoPais(linha.pais) },
  { chave: 'treinamento', titulo: 'Treinar IA com o dado', celula: (linha) => <Estado familia={linha.vedaTreinamento ? 'ok' : 'pendente'}>{textoDoTreinamento(linha.vedaTreinamento)}</Estado> },
  { chave: 'vigencia', titulo: 'Vigência', celula: (linha) => textoDaVigencia(linha) },
]

/** O que identifica a linha: a chave, e o começo da vigência, porque a mesma empresa pode ter saído e voltado. */
const chaveDaLinha = (linha: SuboperadorDaEscola): string => `${linha.chave}@${linha.inicio}`

/**
 * A tela "Empresas que recebem dados", do seletor da Privacidade (F3, 8.0; X2, 13.0; RF7 e RF20): os suboperadores da escola, as empresas por onde o dado dela
 * passa, vigentes e passadas, para a coordenação responder ao responsável e ao titular (LGPD, art. 18, VII). Só leitura: o
 * cadastro e o encerramento são da operação, por comando (`ops:suboperador`).
 *
 * Os quatro estados: carregando, erro com "Tentar de novo", vazio (nenhuma empresa recebe dado da escola) e o dado. As
 * passadas ficam numa seção à parte, que só existe quando há alguma.
 */
export function EmpresasQueRecebemDados() {
  const consulta = useQuery(consultaSuboperadores)
  if (consulta.isPending) return <EstadoCarregando rotulo="Carregando as empresas que recebem dados…" />
  if (consulta.isError && consulta.data === undefined) {
    return <EstadoErro erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => void consulta.refetch({ cancelRefetch: false })} />
  }

  const { suboperadores } = consulta.data
  const vigentes = suboperadores.filter((suboperador) => suboperador.fim === null)
  const passadas = suboperadores.filter((suboperador) => suboperador.fim !== null)
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-das-vigentes">
        <CabecalhoDeSecao
          id="titulo-das-vigentes"
          nivel={3}
          titulo="Empresas que recebem dado da escola hoje"
          apoio="Por onde o dado passa para o sistema funcionar: o que cada empresa faz, o que recebe, onde processa e o que o contrato diz sobre treinar IA."
        />
        {vigentes.length === 0 ? (
          <EstadoVazio titulo="Nenhuma empresa recebe dado desta escola" descricao="Quando o Turmma contratar uma empresa que receba dado da escola, ela aparece aqui, com o que faz e o que recebe." />
        ) : (
          <Tabela rotulo="Empresas que recebem dado da escola hoje" colunas={COLUNAS} linhas={vigentes} chaveDaLinha={chaveDaLinha} />
        )}
      </section>
      {passadas.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-das-passadas">
          <CabecalhoDeSecao
            id="titulo-das-passadas"
            nivel={3}
            titulo="Empresas que já receberam dado da escola"
            apoio="Ficam aqui depois de encerradas: se o responsável perguntar por onde o dado passou, a resposta inclui estas."
          />
          <Tabela rotulo="Empresas que já receberam dado da escola" colunas={COLUNAS} linhas={passadas} chaveDaLinha={chaveDaLinha} />
        </section>
      )}
    </div>
  )
}
