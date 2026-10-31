import type { ReactNode } from 'react'
import { Sino, type ItemDoSino } from '../../components/sino/Sino'
import { Secao } from '../GallerySection'

/** Os itens de exemplo: nomes e turmas inventados, nenhum de ninguém (regra 20, item 17). */
const URGENTE: ItemDoSino = { id: 'a', titulo: 'Incidente de segurança sem confirmação', detalhe: 'Avisado em 01/10/2026. Confirme que recebeu.', urgente: true, para: '/galeria#sino' }
const CONVITE: ItemDoSino = { id: 'b', titulo: 'Refazer o convite de Paulo Sintético', detalhe: 'O convite venceu antes de ser aceito.', urgente: false, para: '/galeria#sino' }
const CONTESTACAO: ItemDoSino = { id: 'c', titulo: 'Camila Sintética contestou a turma', detalhe: '7º A · Química', urgente: false, para: '/galeria#sino' }
const TURMAS: ItemDoSino = {
  id: 'd',
  titulo: 'Turmas sem professor',
  detalhe: 'Aloque um professor em cada uma.',
  urgente: false,
  para: '/galeria#sino',
  contador: { n: 3, oQueConta: 'turmas sem professor' },
}

/** Os itens da professora: agrupados pela turma, sem nome de aluno (regra 20; D34). */
const CORRECAO: ItemDoSino = { id: 'e', titulo: 'Correção para revisar', detalhe: 'Atividade de estequiometria', urgente: false, para: '/galeria#sino', grupo: '1º A' }
const PEDIDOS: ItemDoSino = {
  id: 'f',
  titulo: 'Pedidos de nome para decidir',
  detalhe: '3 pedidos esperando a decisão',
  urgente: false,
  para: '/galeria#sino',
  grupo: '1º A',
  contador: { n: 3, oQueConta: 'pedidos de nome' },
}
const CONFIRME: ItemDoSino = { id: 'g', titulo: 'Confirme sua turma', detalhe: 'Química', urgente: false, para: '/galeria#sino', grupo: '2º B' }

const SEM_FUNCAO = () => undefined
const FALTA_PARA = '/galeria#sino'

function Exemplo({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-cartao border-2 border-borda bg-superficie p-3">
      <p className="t-apoio min-w-0 break-words text-apoio">{rotulo}</p>
      {children}
    </div>
  )
}

/**
 * O sino nos estados dele (telas da coordenação, 1.0, e telas do professor, 1.0): com itens, vazio ("Tudo em dia", sem mascote),
 * lendo, parcial e com erro, e a forma da professora, com os itens agrupados por turma. Cada botão abre a lista no painel ao lado, com dado inventado; nada aqui lê a API.
 */
export default function SecoesDoSino() {
  return (
    <Secao nome="sino" titulo="Sino «Esperando você»">
      <div className="flex min-w-0 flex-col gap-3">
        <Exemplo rotulo="Com itens, nos dois grupos">
          <Sino itens={[URGENTE, CONVITE, CONTESTACAO, TURMAS]} situacao="pronta" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} atualizadoEm={new Date(2026, 9, 16, 9, 30)} faltaPara={FALTA_PARA} />
        </Exemplo>
        <Exemplo rotulo="Vazio: tudo lido e nada espera">
          <Sino itens={[]} situacao="pronta" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} atualizadoEm={new Date(2026, 9, 16, 9, 30)} faltaPara={FALTA_PARA} />
        </Exemplo>
        <Exemplo rotulo="Carregando">
          <Sino itens={[]} situacao="carregando" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} faltaPara={FALTA_PARA} />
        </Exemplo>
        <Exemplo rotulo="Parcial: parte da lista não carregou">
          <Sino itens={[CONVITE]} situacao="parcial" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} atualizadoEm={new Date(2026, 9, 16, 9, 30)} faltaPara={FALTA_PARA} />
        </Exemplo>
        <Exemplo rotulo="Erro: nada carregou">
          <Sino itens={[]} situacao="erro" erro={new Error('sem rede')} aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} faltaPara={FALTA_PARA} />
        </Exemplo>
        <Exemplo rotulo="Da professora: itens agrupados por turma">
          <Sino itens={[CORRECAO, PEDIDOS, CONFIRME]} situacao="pronta" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} atualizadoEm={new Date(2026, 9, 16, 9, 30)} textoDoVazio="Nada espera a sua decisão agora." />
        </Exemplo>
        <Exemplo rotulo="Da professora: vazio, sem o link da escola">
          <Sino itens={[]} situacao="pronta" aoTentarDeNovo={SEM_FUNCAO} aoAtualizar={SEM_FUNCAO} atualizadoEm={new Date(2026, 9, 16, 9, 30)} textoDoVazio="Nada espera a sua decisão agora." />
        </Exemplo>
        <Exemplo rotulo="Da professora: parcial, dizendo o que não leu">
          <Sino
            itens={[CORRECAO]}
            situacao="parcial"
            aoTentarDeNovo={SEM_FUNCAO}
            aoAtualizar={SEM_FUNCAO}
            atualizadoEm={new Date(2026, 9, 16, 9, 30)}
            textoDoVazio="Nada espera a sua decisão agora."
            avisoDaLeituraParcial="Parte da lista não carregou. Não foi possível ler os pedidos de nome de 2 turmas."
          />
        </Exemplo>
      </div>
    </Secao>
  )
}
