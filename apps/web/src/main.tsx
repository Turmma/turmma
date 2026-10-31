import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { aoAbrirSessao, aoTrocarDeSessao } from './api/sessao'
import { criarClienteDeConsultas } from './api/query-client'
import './index.css'
import { iniciarLetra, useTamanhoDaLetra } from './text-size'
import { Rotas } from './routes'
import { iniciarTema } from './theme'

const elementoRaiz = document.getElementById('raiz')
if (!elementoRaiz) {
  throw new Error('Elemento #raiz ausente em index.html')
}

// O tema já foi escrito no `<html>` pelo script do `index.html`, antes do primeiro quadro. Aqui a página passa a acompanhar
// o aparelho (em Sistema) e as outras abas, em toda tela, também nas públicas, que não têm controle (`theme.ts`).
iniciarTema()
// A letra do aluno (8.0): o `index.html` já escreveu o `data-letra` no primeiro quadro, e quem o mantém é o `LetraDoAluno`, mais abaixo. Aqui
// a página só passa a acompanhar as outras abas. Não lê nem grava nada: a chave só é escrita quando o aluno escolhe.
iniciarLetra()

const clienteConsultas = criarClienteDeConsultas()

// Toda sessão que acaba, e toda sessão nova que entra no lugar dela, esvaziam o cache de consultas. O Chromebook do
// carrinho passa por quatro turmas por dia, e a navegação depois do "Sair" não recarrega a página: sem isto, a pessoa
// seguinte entraria e a tela mostraria o nome e a escola da anterior, direto do cache de `/v1/eu` (regra 20, itens 4
// e 5). Na troca de escola vale o mesmo, com a turma no lugar do nome (regra 10, item 1).
//
// `resetQueries` e não `clear` (20.0): o `clear` tira as consultas do cache, mas a tela que continua montada — a que
// fica atrás do login por cima — segue mostrando o último dado que recebeu, porque o observador dela fica preso à
// consulta que saiu. O `reset` esvazia a consulta que a tela observa, e é isso que faz o nome, a escola e a turma da
// pessoa anterior sumirem da tela, e não só do cache. Ele também refaz as buscas que estão na tela, e por isso o
// módulo de sessão só o chama com a credencial certa em memória: nunca com a da escola de onde a pessoa saiu.
aoTrocarDeSessao(() => {
  void clienteConsultas.resetQueries()
})

// E a sessão que volta a valer sem ser uma sessão nova — a aba que reabriu pelo cookie, ou a API que voltou depois de
// uma queda — manda a tela buscar de novo o que falhou enquanto ela não valia. A sessão nova (entrada, escolha ou
// troca de escola) não passa por aqui: ela esvazia o cache inteiro, que já refaz as buscas com a credencial certa.
aoAbrirSessao(() => {
  void clienteConsultas.invalidateQueries()
})

/**
 * Mantém o `data-letra` do aluno (`src/text-size.ts`). Mora aqui, na raiz, e não na área do aluno: a página aberta em `/aluno` sem
 * sessão vai à entrada sem montar a área, e o atributo do primeiro quadro precisa sair junto.
 */
function LetraDoAluno() {
  useTamanhoDaLetra()
  return null
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <LetraDoAluno />
      <Rotas />
    </QueryClientProvider>
  </StrictMode>,
)
