import { describe, expect, it } from 'vitest'
import { BASE_DA_AREA, caminhoDoPedidoDoTitular, ehTelaDeFoco, ROTAS, ROTAS_DA_COORDENACAO, ROTAS_DO_ALUNO } from './paths'

describe('o endereço do pedido de titular (F3, 17.0)', () => {
  it('leva só o id do pedido, na aba Pedidos da Privacidade, e nada além dele vira trecho do endereço', () => {
    expect(caminhoDoPedidoDoTitular('0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41')).toBe('/privacidade/pedidos/0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41')
    expect(caminhoDoPedidoDoTitular('../auditoria?x=1')).toBe('/privacidade/pedidos/..%2Fauditoria%3Fx%3D1')
  })

  it('a rota do pedido tem um trecho a mais que a da aba, e por isso é a que o Switch precisa ver primeiro', () => {
    expect(ROTAS_DA_COORDENACAO.pedidoDoTitular.startsWith(ROTAS_DA_COORDENACAO.privacidade)).toBe(true)
    expect(ROTAS_DA_COORDENACAO.pedidoDoTitular.split('/')).toHaveLength(ROTAS_DA_COORDENACAO.privacidadeDaAba.split('/').length + 1)
  })
})

describe('o endereço do Painel (telas da coordenação, 2.0)', () => {
  it('é /coordenacao/painel pela raiz, e o da área, relativo a ela, é o que o Switch da coordenação lê', () => {
    expect(ROTAS.painel).toBe('/coordenacao/painel')
    expect(ROTAS.painel).toBe(`${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.painel}`)
    expect(ROTAS_DA_COORDENACAO.painel).toBe('/painel')
  })
})

describe('os endereços do aluno (telas do aluno e primeiro acesso, 2.0)', () => {
  it('Início, Eu e a introdução moram na área do aluno, e as chaves levam o nome da área porque `ROTAS.inicio` já é a raiz', () => {
    expect(ROTAS.inicio).toBe('/')
    expect(ROTAS.inicioDoAluno).toBe('/aluno/inicio')
    expect(ROTAS.euDoAluno).toBe('/aluno/eu')
    expect(ROTAS.atividades).toBe('/aluno/atividades')
    expect(ROTAS.inicioDoAluno).toBe(`${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.inicio}`)
    expect(ROTAS.euDoAluno).toBe(`${BASE_DA_AREA.aluno}${ROTAS_DO_ALUNO.eu}`)
  })

  it('o endereço antigo de "Minha turma" continua a existir só como o de origem do redirecionamento, e é outro que o de Eu', () => {
    expect(ROTAS_DO_ALUNO.minhaTurma).toBe('/minha-turma')
    expect(ROTAS_DO_ALUNO.minhaTurma).not.toBe(ROTAS_DO_ALUNO.eu)
  })

  it('a introdução de cada papel é /bem-vindo na área dele', () => {
    expect(ROTAS.bemVindoDoAluno).toBe('/aluno/bem-vindo')
    expect(ROTAS.bemVindoDoProfessor).toBe('/professor/bem-vindo')
    expect(ROTAS.bemVindoDaCoordenacao).toBe('/coordenacao/bem-vindo')
  })
})

describe('ehTelaDeFoco', () => {
  it('é verdadeira nas três introduções, e só no endereço exato dela', () => {
    for (const caminho of [ROTAS.bemVindoDoAluno, ROTAS.bemVindoDoProfessor, ROTAS.bemVindoDaCoordenacao]) expect(ehTelaDeFoco(caminho), caminho).toBe(true)
    expect(ehTelaDeFoco('/aluno/bem-vindo-velho')).toBe(false)
    expect(ehTelaDeFoco('/aluno/bem-vindo/x')).toBe(false)
    expect(ehTelaDeFoco('/bem-vindo')).toBe(false)
  })

  it('é falsa em toda tela de dentro da casca, as do aluno inclusive', () => {
    for (const caminho of [ROTAS.inicio, ROTAS.inicioDoAluno, ROTAS.euDoAluno, ROTAS.atividades, ROTAS.tutor, ROTAS.privacidadeDoAluno, ROTAS.novaConversa, ROTAS.painel, ROTAS.entrar]) expect(ehTelaDeFoco(caminho), caminho).toBe(false)
  })
})
