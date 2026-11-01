import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { consultaMeusVinculos } from '../comum/api/vinculos'
import { caminhoDaTurmaDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { EstadoCarregando, EstadoErro } from '../../../components/states/index'
import { Page } from '../../../components/ui/Page'
import { useTituloDaTela } from '../../../document-title'
import { enderecoDaAba } from './endereco-da-turma'

/**
 * O endereço de antes do Tutor (`/professor/time/tutor`, que o pé do sino ainda cita): hoje ele **leva** ao que a tela mostrava, que
 * mora na aba Hoje da turma (telas do professor, 10.0; RF2). Com uma turma confirmada, vai a `…/turmas/:id?aba=hoje`; com mais de
 * uma, ou com nenhuma, a Turmas, onde a professora escolhe. É `replace`: o endereço antigo não fica no histórico, e o Voltar
 * não cai num redirecionamento que o levaria de novo.
 *
 * "Uma turma" é uma turma, e não um par de turma e disciplina: duas disciplinas na mesma turma levam à turma (regra de
 * `Turma.tsx`: a turma aberta é uma). Enquanto os vínculos não chegam, a tela diz que está carregando; se falham, diz o erro, com
 * "Tentar de novo", e não escolhe uma turma sem saber. Com mais vínculos na página seguinte, também não escolhe: vai a Turmas.
 */
export default function Tutor() {
  useTituloDaTela('Tutor')
  const [, navegar] = useLocation()
  const vinculos = useInfiniteQuery(consultaMeusVinculos)

  const turmas = new Set<string>()
  for (const vinculo of vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []) if (vinculo.estado === 'confirmado') turmas.add(vinculo.turma.id)
  // Há mais vínculos além da primeira página: a turma "única" pode não ser, e a escolha fica em Turmas.
  const unica = turmas.size === 1 && !vinculos.hasNextPage ? [...turmas][0] : undefined
  const chegou = vinculos.data !== undefined

  useEffect(() => {
    if (!chegou) return
    navegar(unica === undefined ? ROTAS_DO_PROFESSOR.turmas : enderecoDaAba(caminhoDaTurmaDoProfessor(unica), 'hoje'), { replace: true })
  }, [chegou, unica, navegar])

  return (
    <Page titulo="Tutor" largura="conversa" tituloSoParaLeitor>
      {!chegou && !vinculos.isError && <EstadoCarregando rotulo="Abrindo o que o Tutor viu…" />}
      {!chegou && vinculos.isError && <EstadoErro erro={vinculos.error} tentando={vinculos.isFetching} aoTentarDeNovo={() => void vinculos.refetch({ cancelRefetch: false })} />}
    </Page>
  )
}
