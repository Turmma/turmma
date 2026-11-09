import { describe, expect, it } from 'vitest'
import { AREA_BASE_PATH, caminhoDaEtapaDaEntrada, caminhoDaTrocaDaProvisoria, caminhoDoPedidoDoTitular, ehTelaDeFoco, ROUTES, COORDENACAO_ROUTES, ALUNO_ROUTES } from './paths'

describe('o endereço do pedido de titular (F3, 17.0)', () => {
  it('leva só o id do pedido, na aba Pedidos da Privacidade, e nada além dele vira trecho do endereço', () => {
    expect(caminhoDoPedidoDoTitular('0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41')).toBe('/privacidade/pedidos/0197f3b0-6f3e-7c11-9a3e-5d1c2b7a8e41')
    expect(caminhoDoPedidoDoTitular('../auditoria?x=1')).toBe('/privacidade/pedidos/..%2Fauditoria%3Fx%3D1')
  })

  it('a rota do pedido tem um trecho a mais que a da aba, e por isso é a que o Switch precisa ver primeiro', () => {
    expect(COORDENACAO_ROUTES.pedidoDoTitular.startsWith(COORDENACAO_ROUTES.privacidade)).toBe(true)
    expect(COORDENACAO_ROUTES.pedidoDoTitular.split('/')).toHaveLength(COORDENACAO_ROUTES.privacidadeDaAba.split('/').length + 1)
  })
})

describe('o endereço do Painel (telas da coordenação, 2.0)', () => {
  it('é /coordenacao/painel pela raiz, e o da área, relativo a ela, é o que o Switch da coordenação lê', () => {
    expect(ROUTES.painel).toBe('/coordenacao/painel')
    expect(ROUTES.painel).toBe(`${AREA_BASE_PATH.coordenador}${COORDENACAO_ROUTES.painel}`)
    expect(COORDENACAO_ROUTES.painel).toBe('/painel')
  })
})

describe('os endereços do aluno (telas do aluno e primeiro acesso, 2.0)', () => {
  it('Início, Eu e a introdução moram na área do aluno, e as chaves levam o nome da área porque `ROTAS.inicio` já é a raiz', () => {
    expect(ROUTES.inicio).toBe('/')
    expect(ROUTES.inicioDoAluno).toBe('/aluno/inicio')
    expect(ROUTES.euDoAluno).toBe('/aluno/eu')
    expect(ROUTES.atividades).toBe('/aluno/atividades')
    expect(ROUTES.inicioDoAluno).toBe(`${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.inicio}`)
    expect(ROUTES.euDoAluno).toBe(`${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.eu}`)
  })

  it('o endereço antigo de "Minha turma" continua a existir só como o de origem do redirecionamento, e é outro que o de Eu', () => {
    expect(ALUNO_ROUTES.minhaTurma).toBe('/minha-turma')
    expect(ALUNO_ROUTES.minhaTurma).not.toBe(ALUNO_ROUTES.eu)
  })

  it('a introdução de cada papel é /bem-vindo na área dele', () => {
    expect(ROUTES.bemVindoDoAluno).toBe('/aluno/bem-vindo')
    expect(ROUTES.bemVindoDoProfessor).toBe('/professor/bem-vindo')
    expect(ROUTES.bemVindoDaCoordenacao).toBe('/coordenacao/bem-vindo')
  })
})

describe('ehTelaDeFoco', () => {
  it('é verdadeira nas três introduções, e só no endereço exato dela', () => {
    for (const caminho of [ROUTES.bemVindoDoAluno, ROUTES.bemVindoDoProfessor, ROUTES.bemVindoDaCoordenacao]) expect(ehTelaDeFoco(caminho), caminho).toBe(true)
    expect(ehTelaDeFoco('/aluno/bem-vindo-velho')).toBe(false)
    expect(ehTelaDeFoco('/aluno/bem-vindo/x')).toBe(false)
    expect(ehTelaDeFoco('/bem-vindo')).toBe(false)
  })

  it('é falsa em toda tela de dentro da casca, as do aluno inclusive', () => {
    for (const caminho of [ROUTES.inicio, ROUTES.inicioDoAluno, ROUTES.euDoAluno, ROUTES.atividades, ROUTES.tutor, ROUTES.privacidadeDoAluno, ROUTES.novaConversa, ROUTES.painel, ROUTES.entrar]) expect(ehTelaDeFoco(caminho), caminho).toBe(false)
  })
})

describe('a troca da senha provisória (acesso-e-convites, 13.0)', () => {
  it('o endereço leva a escola no caminho, codificada, e nada além dela: o bilhete nunca é parte do endereço', () => {
    expect(ROUTES.trocarSenha).toBe('/e/:slug/trocar-senha')
    expect(caminhoDaTrocaDaProvisoria('colegio-a')).toBe('/e/colegio-a/trocar-senha')
    expect(caminhoDaTrocaDaProvisoria('a/b?c=1')).toBe('/e/a%2Fb%3Fc%3D1/trocar-senha')
  })

  it('o login de matrícula com a provisória leva à troca na escola; as outras etapas seguem para a tela delas', () => {
    expect(caminhoDaEtapaDaEntrada('trocar_senha', 'colegio-a')).toBe('/e/colegio-a/trocar-senha')
    expect(caminhoDaEtapaDaEntrada('pronta', 'colegio-a')).toBe('/')
    expect(caminhoDaEtapaDaEntrada('mfa', 'colegio-a')).toBe('/mfa')
  })

  it('sem o endereço da escola (o diálogo da equipe), `trocar_senha` não inventa um: cai na entrada', () => {
    expect(caminhoDaEtapaDaEntrada('trocar_senha', undefined)).toBe('/entrar')
    expect(caminhoDaEtapaDaEntrada('pronta', undefined)).toBe('/')
  })
})
