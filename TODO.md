# TODO fora do código

O que trava o projeto e não se resolve programando. Vários têm prazo externo.

## LGPD e conformidade — prioridade máxima

- [ ] Contrato de tratamento de dados escola↔nós, com advogado (escola controladora)
- [ ] Contrato com provedor de IA vedando treinamento com nosso dado
- [ ] Política de privacidade e termos, com seção de menor de idade
- [ ] Indicar encarregado (DPO) e publicar canal de contato
- [ ] Relatório de impacto (RIPD) — dado de menor, volume alto, IA no fluxo
- [ ] Definir prazos de retenção com uma escola real (varia por rede)
- [ ] Refinar as listas da conferência da saída do Assistente (X6, `conformidade/`, 26.0 a 29.0), medido no lote retido do `ouro`:
      o `e` do "É forte"/"É confuso" também casa a conjunção depois de vírgula; a guarda do infinitivo pega qualquer `-ar/-er/-ir`
      ("É ruim estruturar assim." passa); `aprendeu`, `compreendeu`, `assimilou` e os plurais de `PESSOA_NA_SAIDA` sem frase de teste
      ("O Caio aprendeu a regra."); partes opcionais de `ELOGIO` sem bloco ("Um bom começo!"); a docstring de `SAIDA_AO_PROFESSOR`
      ainda cita "espera a sua aprovação"; os exemplos da 4ª rodada já estão na linha "O que a conferência não pega" do `onda-0.md`
      §2.3, e o `aponta_erros` do `ouro` (4 de 12 escapam) entra na mesma medida
- [ ] D55 abaixo do alvo no lote retido 1 da 3.0 (X6, `conformidade/`, 26.0 a 29.0, com lote retido 2 das duas políticas). A
      saída barra 22/58 (no `ouro`, 54/58) e 3/41 legítimas, por julgar o texto do próprio professor. A entrada barra 33/57 e
      recusa todo pedido sobre o material do professor que traz palavra de nota ou de correção (10/10, já antes da 3.0): é o
      professor que mais vai esbarrar nisso ("dá uma nota de 0 a 10 pro meu enunciado"). Detalhe em
      `docs/aia/ouro-retido/RETIDOS.json` e `onda-0.md` §2.3
- [ ] Risco à vida do Tutor abaixo do alvo no lote retido 2 (X6, `conformidade/`, 26.0 a 29.0, com lote retido 3): 51/75 com a
      regra ou o modelo. O que mais escapa é o indireto (5/15) e a gíria pela regra (6/15). O modelo local falhou em 64 de 384
      chamadas: ver o que o aluno recebe quando o modelo falha num turno de risco que a regra não pegou. E um falso positivo de
      homônimo pelo modelo. Detalhe em `docs/aia/ouro-retido/RETIDOS.json` e `onda-0.md` §2.2a
- [ ] AIA do Assistente (D57): a saída que infere emoção ou estado do aluno ("Ela parece triste.") não é da D55 e a conferência da
      tarefa 3.0 não a pega; entra na avaliação de impacto do Assistente, antes do PRD que o expõe ao aluno
- [ ] Rever a fala do passo 4 da introdução do professor ("Usar ou não esta ferramenta não gera número sobre você", X4, 10.0, `areas/professor/introducao/textos-da-introducao.ts`) quando o painel do próprio professor (D45) entrar: ele passa a ter número sobre si, só dele
- Recusado (11.0, decisão da Mesa): bloco de mutação que troca `alturaMaxima="max-h-[34dvh]"` por `"max-h-none"` na introdução do professor. O bloco
      existe só para a coordenação (`areas/coordenacao/introducao/BemVindo.tsx`, `e2e/coordenacao-introducao.spec.ts`). O `BemVindo.tsx` do professor só passou a usar
      `IntroducaoDoPapel` e `OndeFicaCadaCoisa`, sem mudar a região que rola, e `e2e/professor-introducao.spec.ts` já prova a sobra de altura (a região
      "Leia até o fim" e `paginaNaoRola` a 1366 × 768). Reabrir se a tela do professor mudar a região
- [ ] Conferir se `apps/api/src/tutor/tutor.int.test.ts` cobre a **leitura** dos sinais `travou` e `duvida_repetida` pelo professor, e não só o
      nascimento deles (a linha "Do Tutor você vê o uso" da introdução do professor promete isso; regra 70, item 7)
- [ ] Introdução da coordenação (X4, 11.0): o `roteiro-da-demonstracao.spec.ts` entra por `linkDaCoordenacao` (convite da operação) e repete o convite, a senha e o
      segundo fator que `entrarComoCoordenacaoPeloConvite` já faz; juntar as duas entradas pede a fixture da operação, na tarefa que tocar o roteiro
- [ ] `OndeFicaCadaCoisa.tsx` usa `id="onde-fica-cada-coisa"` fixo: trocar por `useId()` se a peça aparecer duas vezes na mesma tela
- [ ] Introdução da coordenação (11.0), **pedido ao Arquiteto, antes da validação**: o passo 3 ("Abrir um aluno ou um professor pelo nome pede um motivo") promete
      mais do que a lista da turma e a lista de professores fazem, e o passo 2 ("sem nome de pessoa") não vale para Escola › Turmas; o texto vem do PRD (RF15) e a frase certa é dele
- [ ] `/v1/eu` da coordenação traz só a data da própria pessoa, e a coordenadora com vínculo em duas escolas tem uma data por escola (visto na A não vale na B): caso na API da 1.0
- [ ] Cenário de carga do login: conferir que a coordenação caindo em `/coordenacao/bem-vindo` uma vez por pessoa está coberta (poucas pessoas por escola, fora do pico), e a métrica da rota `POST /v1/eu/introducao` (contador de falha da gravação) na API da 1.0
- [ ] Nenhum caso abre `/coordenacao/bem-vindo` como professor ou aluno: cobrir na tarefa que tocar a guarda da área
- [ ] `textos-da-introducao.test.ts` (11.0): o caso `"dois ou mais" é o grupo mínimo que o código aplica` repete o `toContain` do caso do passo 2; juntar os dois ou apagar o segundo
- [ ] `e2e/coordenacao-introducao.spec.ts` (11.0): no caso dos quatro passos o `expect(gravacoes).toHaveLength(1)` final não espera nada depois do `poll`, e o comentário "nenhuma tardia" promete mais do que prova (a prova é a do caso do "Pular"): ajustar o comentário
- [ ] Guarda de arquitetura que impeça importar `e2e/__fixtures__` fora de `e2e/` (o `introducaoVistaEmDoUsuario` lê sem `escola_id`)
- [ ] Ao rever a fala do passo 4 da introdução do professor (linha acima), manter que o número é só do professor e nunca alimenta decisão sobre ele
      (regra 20, item 10a; regra 70, item 8), e lembrar que a promessa "a conversa não aparece para a coordenação" vale por
      `apps/api/src/assistente/assistente.int.test.ts`: se a camada de rede ou um painel da coordenação ganhar leitura do Assistente, a frase muda junto
- [ ] O pedido do titular (acesso e portabilidade, F3, `ciclo-de-vida.service.ts`) cobre também a `lista_nome` e a
      `reivindicacao` da A1, para a pergunta de fechamento da regra 20 continuar respondida por código: o pedido se liga
      ao aluno por `lista_nome_id` enquanto a linha da lista existe, e depois do `set null` já não se liga a ninguém
      (`privacy-guardian` na 6.0)
- [x] O expurgo dos pedidos de reivindicação decididos (e dos fechados como `encerrada` na virada do ano), com a retenção
      configurável por escola (regra 20, item 16). Feito no F3, tarefa 5.0: a categoria `reivindicacao_decidida` os apaga
      60 meses (12 a 60) depois da decisão, ou da solicitação no `encerrada`, no `retencao.expurgar-escola` (A1, tarefa 10.0)
- [ ] Escrever e ensaiar o processo de incidente
- [ ] Parecer sobre o ECA Digital (Lei 15.211/2025) para plataforma contratada pela escola,
      com a avaliação de impacto que ele exige. Três perguntas precisam sair dele, nomeadas:
      **(a)** o art. 24 alcança serviço educacional contratado pela escola? Se sim, conta de
      aluno de até 16 anos precisa estar vinculada à de um responsável legal, e o portal da
      família sai da fase posterior (**bloqueia o PRD do F9**, `docs/regulacao.md` 2.2);
      **(b)** como os arts. 17 e 18 (supervisão parental) se modulam pelo art. 39 no nosso
      caso; **(c)** a aferição de idade pela série informada pela escola basta, com o art. 24
      do Decreto 12.880 como fundamento de proporcionalidade? **(d)** ligar a busca do Tutor em
      fontes aprovadas para aluno de até 16 anos, sem conta de responsável vinculada, conta
      como rebaixar a proteção (art. 24, § 5º; D68)? **(e)** a contagem de saídas da aba
      durante avaliação é proporcional, e algo parecido pode existir fora de avaliação (D70)?
- [ ] **Avaliação de Impacto Algorítmico** escrita para cada funcionalidade de alto risco —
      Tutor, correção de objetiva, diagnóstico por habilidade, sinais e alertas, adaptação —
      no roteiro de seis etapas de `docs/conformidade-mec.md` seção 7 (D60). Cada uma antes do
      PRD da sua funcionalidade, não no F16. Ficam em `docs/aia/` (índice no `README.md` de
      lá); o Joaquim escreve o rascunho da etapa 1 e o Gabriel revisa
- [ ] **Dossiê de conformidade** da escola (D61): declaração de propósito com faixas etárias,
      funcionamento em linguagem simples com fluxograma, conformidade LGPD e ECA artigo por
      artigo, RIPD, AIA, relatório de uso legível, material de comunicação com a comunidade
- [x] **Aviso de privacidade em linguagem de faixa etária**, para aluno de 11 anos (exigido
      pelo art. 16 do ECA Digital e pelas cláusulas sugeridas pelo MEC). Feito na X4, tarefa 9.0
      (`apps/web/src/areas/aluno/introducao/`). **Falta** a revisão do texto por orientação
      educacional e por advogado (`docs/aia/tutor.md`, pendência 12). A decisão do Joaquim (26/10/2026, opção A)
      está feita na correção `2026-10-26-mensagem-fixa-avisa-o-professor`: a mensagem fixa que o aluno recebe ao
      contar algo pessoal difícil (`packages/nucleo/src/ia/tarefas/turno-do-tutor.ts`) e o aviso de privacidade dizem a
      mesma frase, `FRASE_DO_AVISO_AO_PROFESSOR` (`packages/shared/src/tutor/sinal.ts`), uma constante só; mudar o texto
      na revisão é mudar ela. **Falta** a fixture de e2e `MENSAGEM_FIXA` (`e2e/__fixtures__/aluno.ts`, ~250-255) terminar
      nessa frase, e `e2e/aluno-tutor.spec.ts` e `e2e/aluno-fluxo.spec.ts` conferirem a frase no cartão (só roda na
      esteira; fora da correção `2026-10-26-mensagem-fixa-avisa-o-professor`). Entram na mesma revisão de
      texto: o registro de acesso (Marco Civil), que o aviso não cobre, e `FRASE_DO_QUE_NAO_TEMOS`
      ("Não temos seu e-mail…"), que ficou na primeira pessoa enquanto o grupo diz "A escola guarda".
      **Gatilhos para mudar a frase do aviso ao professor:** (a) no dia em que existir a tela ou a rota que abre a
      conversa de um aluno ao professor (regra 50, item 10), e (b) quando o F9 der à orientação ou à direção acesso
      auditado ao conteúdo, para notificar o Conselho Tutelar (Lei 13.819/2019; `docs/agentes.md`, `docs/regulacao.md`
      seção 7). Em qualquer dos dois, a frase e o aviso mudam juntos (pendência 12 de `docs/aia/tutor.md`)
- [ ] Aviso de privacidade rolável (`BemVindo.tsx`, `AvisoDePrivacidade`): `haMais` começa `true`, e
      se o aviso coubesse inteiro numa tela alta a faixa "Role para ler mais" ficaria para sempre.
      Hoje não acontece (17 frases passam de `28dvh` em qualquer tela real); medir
      `scrollHeight > clientHeight` ao montar e no redimensionamento, com um teste de
      `scrollHeight` igual a `clientHeight` sem evento de rolagem (X4, 9.0)
- [ ] `textos-da-introducao.test.ts` lê `e2e/__fixtures__/casca.ts` por expressão regular, que
      quebra com apóstrofo ou template string; o `e2e/` importar o `.ts` puro dos textos resolveria
      na origem, mas muda como o e2e importa módulo da web (X4, 9.0, revisor-geral)
- [ ] Quem revê a introdução (Eu → "Rever a introdução") fica com Eu duas vezes no histórico, porque
      o `replace` do fechamento troca só a entrada da introdução (`BemVindo.tsx`); decidir se
      "Voltar" do navegador deve pular a duplicata (X4, 9.0, revisor-geral)
- [ ] "Esse programa é de uma empresa contratada" (aviso de privacidade) só é verdade com provedor
      externo: ligar a frase ao cadastro de suboperadores da escola, quando a tela de suboperador
      existir (X4, 9.0, privacy-guardian)
- [ ] `infra/k6/login-7h30.js`: o seed da rajada cria os alunos com a introdução já vista; falta
      uma variante com parte das contas em `por_ver`, para medir o `POST /v1/eu/introducao` na
      manhã de segunda (X4, 9.0, infra-guardian)
- [ ] Cláusulas do contrato com a escola que o MEC sugere e que ainda não temos:
      responsabilização por incidente, alerta em tempo real ao supervisor quando conteúdo
      proibido for gerado, teste de segurança antes de atualização
      (`docs/conformidade-mec.md` seção 6)
- [ ] Base legal da conversa do tutor e dos sinais, na particular e na pública (Enunciado
      CD/ANPD 1/2023; teste de balanceamento se for legítimo interesse)
- [ ] Indicadores de professor com advogado: CLT, convenção coletiva de cada sindicato
      (SINPRONORTE lida, sem cláusula sobre IA) e estatuto do servidor na rede pública (D45)
- [ ] Contrato com a escola: responsabilidade civil por resposta errada do tutor e direito
      de regresso
- [ ] Protocolo de risco à vida com a escola: quem notifica o Conselho Tutelar (Lei
      13.819/2019, Lei 15.231/2025) e como o sinal chega a essa pessoa
- [x] ~~Decidir região de hospedagem~~ — Brasil (D28)

- [ ] **A lista de nomes colada pela coordenação** (`privacy-guardian` e `revisor-geral`, 13.0 da A1), antes de qualquer
      dado real, a levar para o `/validar` da A1:
      - [x] ~~CPF sem pontuação passa pela trava da prévia~~ — a lista com mais da metade das matrículas, e pelo menos
        duas, em 11 algarismos com dígito verificador de CPF válido tem essas linhas recusadas pela API; o avulso
        sozinho passa (correção `2026-10-03-trava-de-documento-so-na-tela`)
      - colunas a mais (nascimento, CPF, telefone numa exportação da secretaria) trafegam no corpo da prévia e da
        gravação, sem serem gravadas nem logadas: a tela avisar, ou recortar para nome e matrícula antes de enviar
      - a sessão que vence com a lista colada na tela: hoje o texto e a prévia somem porque a consulta da turma volta a
        pendente (seguro para a pessoa seguinte, e o rascunho de quem volta se perde). Decidir se o rascunho sobrevive
        para a mesma pessoa, e ter um e2e do caso "outra pessoa" (nenhum nome nem matrícula atrás do login por cima)
      - [x] ~~a trava de CPF ou data existe só na tela~~ — a regra foi para o contrato
        (`packages/shared/src/estrutura/documento-na-matricula.ts`), e a API recusa na prévia
        (`matricula_parece_documento`), na gravação da lista e no avulso (`ENTRADA_INVALIDA`) (correção
        `2026-10-03-trava-de-documento-so-na-tela`, G2). A saída para o falso positivo segue no item abaixo, e no
        servidor ela pesa mais
      - a trava de documento não tem saída para falso positivo: a escola cuja matrícula tenha forma de data
        (`2026-02-01`, `1/2/26`) não consegue gravar, nem pela lista nem pelo avulso, e o texto não diz o que fazer; a
        recusa agora é da API, e nenhum cliente contorna. Perguntar o formato da matrícula nas entrevistas do piloto. Junto, o motivo de não
        gravar diz "a segunda coluna" mesmo com uma linha só; "enquanto houver matrícula que pareça CPF ou data de
        nascimento" serve aos dois (`frontend-reviewer`, correção `2026-10-03-trava-de-documento-so-na-tela`)
      - o CPF que o Excel exporta como número perde o zero à esquerda (`012.345.678-90` vira `1234567890`, 10
        algarismos), e `pareceCpfSemPontuacao` não o reconhece: na coluna inteira de CPF a lista já é recusada pelas
        outras linhas, mas, se a coordenação apagar só as marcadas, as de 10 algarismos ficam abaixo da maioria e gravam.
        Completar com zeros à esquerda antes de conferir o dígito, com o falso positivo medido (`test-engineer` da
        correção `2026-10-03-trava-de-documento-so-na-tela`)
      - e2e da coluna com maioria de CPF sem pontuação na tela (`test-engineer` e `frontend-reviewer` da mesma
        correção): hoje provada na integração e na unidade da web; o job de e2e está perto do teto de 45 min, e o caso
        entra quando o e2e da lista for dividido
      - `Cache-Control: no-store` nas respostas nominais da API (`/retro` da A1, registrado no `2_task.md`): a web já
        pede sem cache (`cache: 'no-store'` no `chamarApi`, 13.0); falta o cabeçalho, para qualquer outro cliente
- [ ] **(F3, 18.0) O resumo de "Meus dados" conta só as categorias de prazo configurável** (`privacy-guardian`, 1ª rodada):
      credencial, sessão e registro de acesso com IP (`retencao.ts:91-100`) ficam fora da contagem. Decidir com a 13.0 entre
      dizer na tela que o arquivo traz também esses registros e contá-los na API; depende do que o arquivo realmente contém
      (dono: Joaquim)
- [ ] **(F3, 18.0) Conferir o `EFEITO_DE_BAIXAR` contra o arquivo montado na 13.0** (`privacy-guardian`, 1ª rodada): o texto diz
      "as suas conversas com a IA" aos dois papéis; confirmar que o arquivo do aluno traz a conversa do Tutor dentro da
      retenção. A tela não muda sem essa conferência (dono: Joaquim)
- [ ] **(F3, 18.0) Rever os rótulos mais técnicos do resumo de "Meus dados"** (`frontend-reviewer`, 2ª rodada; diagnóstico do
      Arquiteto): "As chamadas ao modelo de IA que o seu uso gerou" e "Os materiais da escola que você enviou ou excluiu"; e
      "As suas respostas e as correções das suas atividades", cuja contagem é a de atividades começadas
      (`tentativa_atividade`), e não a de respostas. Rever junto da conferência do arquivo da 13.0, no item acima
      (dono: Joaquim)
- [x] **(F3, 13.0) O resumo do arquivo do titular diz "Os pedidos de entrada na turma que você fez ou decidiu"** — *resolvido na correção `2026-10-10-resumo-do-arquivo-do-pedido-de-entrada`: o texto do arquivo é o da tela, e a consulta diz que o pedido recusado antes entra de propósito. O rótulo por papel ficou de fora: o texto com os dois caminhos é verdadeiro para os dois, e um por papel muda a forma de `LeituraDaTabela` (desenho).*
      (`packages/nucleo/src/titular/leitura-do-titular.ts`, `LEITURAS_DO_ARQUIVO.reivindicacao.descricao`), e a consulta do
      aluno traz todo pedido feito no nome dele na lista, inclusive o recusado antes, que pode ser de outra pessoa (a recusa
      devolve o nome a `livre` e o pedido continua na linha: `devolverNome`, `apps/api/src/sala/decisao/decisao.repository.ts`). A
      tela da 18.0 diz "feitos com o seu nome ou decididos por você": alinhar o texto do arquivo e o comentário da consulta
      ("o pedido que o aprovou") por `/corrigir`, antes da validação do F3. Ao alinhar, escreva na consulta que o pedido
      recusado antes naquele nome entra de propósito e não identifica outra pessoa (`privacy-guardian`, 3ª rodada).
      Considere um rótulo por papel na tela: o aluno nunca decide um pedido, e "…ou decididos por você" só vale para o
      professor (`frontend-reviewer`, 3ª rodada) (diagnóstico do Arquiteto, 18.0)
      - Sobrou da correção, para a **validação do F3** (`test-engineer` e `privacy-guardian`, 1ª rodada): (a) o mesmo texto da
        `descricao` vive em `leitura-do-titular.ts` e em `apps/web/src/componentes/meus-dados/regras.ts`, cada um com seu teste, e
        nada confere que os dois são iguais: fonte única em `packages/shared` ou teste que confronte os dois, junto da decisão
        de desenho da forma de `LeituraDaTabela`; (b) teste de integração em que o aluno aprovado depois de uma recusa no mesmo
        nome recebe os dois pedidos no arquivo, sem `decidida_por` nem `teve_matricula_errada` (o seed de
        `apps/api/test/pedido-titular.int.test.ts` só tem o pedido aprovado).

## Infra e operação

- [ ] **(Telas do aluno, 3.0) A carga da rajada de login, passada pelo seed** (`revisor-geral` e `infra-guardian`, 1ª rodada): em
      `infra/scripts/carga-login.ts` o ano letivo e as datas do seed são fixos em 2026 (`matriculaSintetica` também); só importa
      quando a carga rodar depois de 2026. `semearTurmasEAtividades` recebe `pool` e o resto usa `banco` (duas conexões no mesmo seed);
      o seed só tem atividade com `avaliativa=false`. Na mesma passada: dar a `GET /v1/eu` limite próprio no k6, simétrico ao de
      `minhas-atividades` (hoje entra só no limite de todas as autenticadas; o spec 7c pede o próprio só para as tarefas), e, se a
      validação quiser, conferir que os itens da página são da escola de quem entrou (`tenancy-guardian`, 1ª)
- [ ] **(Telas do aluno, 3.0) A vitrine cheia semeia atividade aplicada** (`frontend-reviewer`, `conformidade-reviewer`,
      `privacy-guardian` e `test-engineer`, 1ª a 3ª): `tools/vitrine/` não semeia nenhuma, e a foto do Início só mostra o vazio.
      Semear uma atividade aplicada, uma delas avaliativa e uma com título sem espaço (para a foto do celular mostrar a quebra a
      360 px), antes de o Validador fotografar a spec; a medida de 44 px do título entra junto, com `boundingBox()` no e2e.
      Entra também uma atividade "Para fazer" aberta, para fotografar a questão em letra Maior a 360 px (correção
      `2026-10-25-enunciado-nao-acompanha-a-letra`, `frontend-reviewer`, 1ª). **Retro da X4 (M7, aceita em 26/10/2026):** sobe a
      correção própria antes da próxima spec de tela, com uma tarefa a entregar, o seed "respondeu 0 de 4" com "acertou 3 de 4" (C2)
      e a lista de Física com habilidade de Química (MN10) juntos: foi a falta da "Para fazer" nas fotos que escondeu o C1 e o C2 da
      validação da X4 (dono: Orquestrador)
- [ ] **(Telas do aluno, correção `2026-10-25-enunciado-nao-acompanha-a-letra`) Mais `text-[Npx]` na área do aluno** (`test-engineer`, 1ª):
      o mesmo defeito do enunciado, o tamanho em `px` que não acompanha a letra Grande ou Maior, está em `Toque.tsx:39`, `Aviso.tsx:54`,
      `ui/ia/AssinaturaIA.tsx:34`, `ui/onca/Onca.tsx:124`, `meus-dados/MeusDados.tsx:217` e `MenuDaPessoa.tsx:64`. Corrigir em
      correção própria, medindo cada um com a letra Maior, e acrescentar a guarda que recuse `text-[Npx]` nas telas do aluno
- [ ] **(Telas do aluno, 3.0) O recomeço do Início está duplicado** em `e2e/aluno-inicio.spec.ts` e `e2e/minha-turma.spec.ts`
      (`test-engineer`, 1ª): apagar um dos dois numa passada de e2e (dono: quem tocar `minha-turma.spec.ts`)
- [x] **(Telas do aluno, correção `2026-10-25-eu-cabe-em-1366`) Foto do Eu a 1024 px** (feito na validação da X4, rodada 2, 25/10/2026: cabe) (lateral aberta, cartões de "Como estou indo" com ~360 px):
      o Validador fotografa a 1024 px no fim da spec (dono: Validador; origem: a correção, `frontend-reviewer` 1ª)
- [ ] **(Telas do aluno, correção `2026-10-25-eu-cabe-em-1366`) Caso de e2e com nome de escola ou de turma de 60 ou mais caracteres**, que quebra a linha
      de apoio do título do Eu em duas: medir se a página ainda cabe a 1366 × 768 (dono: quem tocar `e2e/aluno-eu.spec.ts`; origem: a correção, `test-engineer` 1ª)
- [ ] **(Telas do aluno, correção `2026-10-25-eu-cabe-em-1366`) A vitrine reaproveita a sessão e o que ela guardou no navegador**: `tools/vitrine` deve limpar
      `.processo/vitrine/sessao-aluno.json` e o `localStorage` entre as fotos, porque a foto de "Ajustes › Maior" deixa `educa.letra=maior` e a seguinte sai em
      outro tamanho (a sessão guarda também token de aluno sintético). Correção própria em `tools/vitrine/` (dono: Orquestrador; origem: a correção,
      `test-engineer` e `privacy-guardian` 1ª)

- [ ] **(Telas do aluno, correção `2026-10-26-material-sem-licenca-perto-do-prazo`) Casos de `e2e/material.spec.ts` entre 16 e 24 s** (`infra-guardian` e
      `test-engineer`, 1ª): `a coordenação sobe o PDF…`, `enquanto o material está sendo lido…`, `depois da recusa o diálogo continua aberto…` (a mesma forma do
      caso corrigido: `abrirMaterial` mais a espera da lista sob a rede lenta, o próximo candidato no censo) e `os estados sem dado…`, mais a `segunda pessoa…`
      (`test.slow()` desde antes, 33 a 35 s de 90). Se o censo os apontar, `abrirMaterialPeloEndereco` com `aguardar` é o caminho (dono: quem tocar o spec)
- [ ] **(Telas do aluno, 1.0) `lock_timeout` curto na gravação do `GET /v1/eu`** (`infra-guardian`, 1ª rodada): a gravação da linha da sessão,
      disparada por data de outra escola, espera a trava da linha sem prazo próprio; transação longa que a segure pendura o `GET`.
      Muda comportamento: abrir só se o painel "Datas da introdução que não gravaram" mostrar falhas junto com latência alta do `/v1/eu`.
- [ ] **Migrations 0025, 0026 e 0027 (F3, tarefas 3.0 a 5.0) antes do staging:** o check `job_registro_chave_so_com_escola`
      entrou direto e percorre `job_registro` com a trava `ACCESS EXCLUSIVE` (a fila quente, 7 dias de jobs); os índices
      `(escola_id, <data>)` de `mensagem_tutor`, `sinal_tutor` e `mensagem_agente` (0025), os cinco índices parciais de
      anonimização em `execucao_agente`, `consumo_ia` e `artefato` (0026) e os nove da 0027 (`tentativa_atividade
      (escola_id, aluno_id)`, `(escola_id, material_id)` em `mensagem_tutor` e `sinal_tutor`, e os parciais de
      `reivindicacao`, `material`, `usuario` e `vinculo`, mais `execucao_agente (escola_id, solicitada_por)` e
      `artefato (escola_id, criado_por)`) entraram sem `concurrently`. Com dado
      sintético, cabe; a partir do staging, **toda** migration nova leva cada check em arquivo próprio com `NOT VALID` e
      `VALIDATE`, e índice com `concurrently` fora de transação (Tech Spec do F3, seção 7c). O `migrar` usa o
      `statement_timeout` de 2 s da consulta (`packages/nucleo/src/db/migrar.ts`): com volume real, um `CREATE INDEX` em
      `execucao_agente` ou `consumo_ia` passa disso e derruba o deploy, então o prazo do migrador muda junto.
      Os índices de `execucao_agente` e de `mensagem_tutor` são os que mais pesam, porque as duas tabelas crescem por turno
      do Tutor (`docs/infra.md` 3.6); o prazo é o portão do piloto (`infra-guardian` da 3.0, da 4.0 e da 5.0). A 0028 (tarefa 7.0) soma o check
      `consumo_ia_provedor_so_no_envio_externo` em `consumo_ia`, também sem `NOT VALID`: a partir do staging, ele vai em
      arquivo próprio, com `NOT VALID` e depois `VALIDATE` (`infra-guardian` da 7.0)
      A 0035 (F3, tarefa 14.0) entra na lista: o `sessao_motivo_valido` é recriado sem `NOT VALID` e percorre `sessao` sob
      ACCESS EXCLUSIVE, e o `create unique index` de `pedido_titular_agendado_unico` roda sem `concurrently`; a partir do
      staging, o check vai em arquivo próprio, com `NOT VALID` e depois `VALIDATE`, e o índice com `concurrently`, fora do
      horário letivo e com `lock_timeout`.
- [ ] **Escrita a mais por troca do Tutor (F3, 4.0):** `execucao_agente_a_anonimizar_idx`,
      `execucao_agente_do_tutor_a_anonimizar_idx` e `consumo_ia_aluno_a_anular_idx` recebem quase toda linha recente, e
      cada troca do Tutor passa a atualizar índices a mais nas duas tabelas (`infra-guardian` da 4.0). **A 19.0 mediu o custo
      por linha**, e não o do turno inteiro: a fase do expurgo do `npm run carga` insere 20 mil linhas de Tutor com e sem os
      índices, na mesma transação, e imprime os microssegundos a mais por linha (`medirEscritaDosIndices`, informativo, sem
      limite na Tech Spec). **O turno do Tutor da B entrou na fase** (rodada 1 da 19.0): a rota `POST /v1/tutor/mensagens`, com 30
      alunos sintéticos, 1,5 turno por segundo e o adaptador falso de latência simulada (`IA_LATENCIA_FALSA_MS=300`), com o p95
      do turno durante o trabalho da A até 500 ms acima da base. O que **segue aberto** é o cenário "Tutor em sala"
      (`docs/infra.md` 3.2): a semente da B tem só ano, turma e vínculos, sem sala, atividade nem material, então o turno não
      lê trechos do material, e a medida é a de conclusão da execução, não a do primeiro token. Abrir antes do piloto, com o
      p95 do primeiro token. Junto: a fase `base` não exige um mínimo de turnos **no banco** (só o `count>0` do k6), e uma base
      com 1 ou 2 turnos dá um p95 de pouco valor; entra com critério e teste de unidade próprios (`test-engineer` da 19.0).
- [ ] **(F3, 19.0) Contração do check de `provedor` em release posterior ao F3:** a 0028 só expandiu (coluna `consumo_ia.provedor` e o
      check que a prende ao envio externo, validado na própria migration porque toda linha existente tem `provedor` nulo). A
      exigência de `provedor` em toda linha com `envio_externo` vai numa migration de um release **posterior** ao que leva o código do
      F3, em arquivo próprio: `not envio_externo or provedor is not null or em < '<corte>'`, `NOT VALID` e depois `VALIDATE`. O
      `<corte>` é o instante, tirado do registro do deploy, a partir do qual todas as instâncias rodam o código do F3. **O `VALIDATE`
      se mede no volume do staging**: `consumo_ia` é a tabela que mais cresce depois de `execucao_agente`, e o `migrar` roda com o
      `statement_timeout` de 2 s da consulta (`packages/nucleo/src/db/migrar.ts`), então o prazo do migrador muda junto. Pré-condição
      do rollback, já no runbook ("Voltar o código com eliminação agendada em curso"): com a contração aplicada, voltar o código para
      antes do F3 exige antes o `drop constraint` dela (Tech Spec do F3, seção 3; `infra-guardian` da revisão da spec).
- [ ] **(F3, 19.0) O expurgo de 1 milhão de linhas dura segundos, e a fase mede a B durante eles:** no `npm run carga`, o expurgo e a troca de
      nome da escola A terminam em menos de 15 s com 2 CPUs no Postgres; por isso a fase confere a espera da B **só nos jobs que
      nasceram durante o trabalho da A** (pelo menos 10, e 5 turnos do Tutor, que a escola limita a 120 pedidos de IA por minuto),
      e não nos dois minutos do k6. Se o volume do piloto passar de 10 milhões de linhas por escola, subir `VOLUME_DA_A` em
      `infra/scripts/expurgo-da-carga.ts` e rodar de novo; a fase reprova sozinha com poucas amostras da B. O corte do statement
      é de 1,5 s, abaixo do `statement_timeout`, e o statement cancelado pelo timeout (que não aparece no `max_exec_time`) reprova
      pela leitura do log do Postgres. Ainda desse cenário (`infra-guardian`, `revisor-geral`, `tenancy-guardian` e
      `privacy-guardian` da 19.0): (a) o runbook, em "Rodar o cenário de carga", dizer que o statement mostrado na saída é o
      primeiro lugar a olhar, já que o log cobre a fase inteira; (b) `lerStatements(...).catch(() => undefined)` descarta o erro
      sem imprimir, como já fazia o `prepararMedicaoDeStatements` antes da 19.0: imprimir o motivo; (c) `lerStatements` imprime
      até 160 caracteres do texto normalizado com `track=all` e `formasDosStatementsCancelados` imprime o `STATEMENT:` bruto do
      log: só servem ao projeto `educa-carga`, com dado sintético, e reabrem (filtrar `toplevel`, deixar de fora o que não é
      DML) se algum dia rodarem fora dele.
- [ ] **(F3, 19.0) `incidentes.avisados` do `ops:privacidade` herda o teto da lista da coordenação:** o comando conta pelo
      `IncidenteDaEscolaRepository.daEscola`, que limita a `LIMITE_DA_LISTA_DE_INCIDENTES`; uma escola com mais incidentes que o
      teto vê um número menor que o real. Trocar por um `count(*)` no leitor (que é da tarefa da coordenação) quando a primeira
      escola chegar perto do teto; o teto está declarado no comentário de `apps/api/src/ops/privacidade.ts` (`privacy-guardian` e
      `tenancy-guardian` da 19.0)
- [ ] **Alerta de duas noites do expurgo (F3, 3.0):** a noite conta "de ontem para trás", então o alerta dispara à
      meia-noite local (umas 17 h depois de a segunda noite parcial ser conhecida) e segue ligado o dia em que uma noite
      completa roda; numa escola a oeste de São Paulo (Acre, o disparo da 1h cai às 23h locais), uma execução que passa da
      meia-noite divide as categorias entre dois dias e pode dar falso alerta. Avaliar contar a noite pela chave do job (a
      data local do disparo) antes da primeira escola fora do fuso de São Paulo; e trocar a medição de uma consulta por
      escola por uma agrupada quando passar de centenas de escolas (`infra-guardian` e `revisor-geral` da 3.0)
- [ ] **Categoria que falha toda noite segura as seguintes (F3, 3.0):** a linha `false` do lote que falha vira a
      categoria pendente, e a noite seguinte (e cada nova tentativa da fila) começa por ela; se o erro se repete ali, as
      categorias que vêm depois deixam de rodar. O alerta de duas noites dispara, e o runbook cobre (causa 3). Separar a
      linha de falha da de interrupção pela janela (só a interrupção define a pendente), ou seguir para as outras
      categorias antes de subir o erro. Desde a 5.0, a falha pode vir de uma pessoa só em `pessoa_desativada`, e então as
      outras categorias deixam de rodar toda noite. Tratar a separação entre linha de falha e linha de interrupção junto com
      isso, antes do piloto, e não depois (`infra-guardian` da 3.0, 2ª rodada e da 5.0, 3ª rodada, e `revisor-geral` da 5.0)
- [ ] **Ordem das travas entre convidar e eliminar (F3, 5.0):** o `convidar` (`apps/api/src/sessao/convite/convite.service.ts`) trava a conta antes do usuário, e o `CicloDeVidaService` trava o usuário antes da conta. Se a coordenação convida de volta, pelo mesmo e-mail, quem o expurgo está eliminando no mesmo instante, sai deadlock (40P01): nada se corrompe, o expurgo grava `false` e tenta de novo, e o convite é refeito. Alinhar a ordem, ou responder `INDISPONIVEL_TENTE_DE_NOVO` no 40P01 (`infra-guardian` e `test-engineer` da 5.0)
- [ ] **Tempo do lote de 100 pessoas (F3, 5.0):** o «tempo do lote» da 5.0 mediu só a cascata do `trabalho_do_aluno`. Medir o lote de `pessoa_desativada` inteiro (a escolha mais as 100 eliminações, uma transação cada) contra a janela letiva e o `statement_timeout`, com volume de Tutor na escola, antes do piloto (`infra-guardian` da 5.0)
- [ ] **Medição do expurgo depois de o catálogo crescer (F3, 5.0):** `apps/worker/src/medicao-do-expurgo.ts` conta as noites contra o `CATEGORIAS_DO_EXPURGO` atual, que passou de 7 para 12. Num ambiente com noites gravadas com 7, as duas noites anteriores ao deploy contam como incompletas e `expurgo.noites_incompletas` fica em 2 por cerca de um dia e meio. Sem efeito hoje (não há staging); pôr um parágrafo no runbook quando houver (`revisor-geral` da 5.0)
- [ ] **`NAO_ENCONTRADO` do `ops:incidente` sem a posição da seção (F3, 9.0):** o comando responde `NAO_ENCONTRADO: escola não encontrada`
      e não diz qual das escolas do arquivo falhou; num incidente de dezenas de escolas, o operador procura à mão. Citar a posição
      (`a seção N`) muda a saída fixa que `apps/api/test/incidente.int.test.ts` afirma (contrato do comando); fazer quando houver
      operador reclamando.
- [ ] **Encerramento da medição do incidente sem teste (F3, 9.0):** `await medicaoDoIncidente?.encerrar()` em
      `apps/worker/src/montagem.ts` não tem teste próprio (a classe tem; a montagem não): o intervalo de 5 min não é injetável por
      `montarWorker`. Provar exige tornar o intervalo opção da montagem, que é mudança de contrato do worker.
- [x] **Troca de nome da eliminação e o incidente (F3, 15.0):** *resolvido na 15.0: `incidente` e `incidente_escola` ficam fora, com o motivo em `COLUNAS_DA_TROCA_DE_NOME` e em `docs/lgpd.md`.* conferir que `incidente` e `incidente_escola` não precisam entrar
      na troca de nome da eliminação do 8º dia: o registro não guarda texto sobre pessoa, e a regra "nenhum dado de titular" é
      disciplina de quem escreve (runbook, "Ao registrar o incidente"). Se a 15.0 enumerar as colunas de texto livre, a lista
      deve dizer por que estas ficam de fora.
- [ ] **(F3, 15.0) A coordenação como titular:** `pedido_titular.papel_titular` segue `aluno` ou `professor`, e a única coordenadora
      de uma escola que quer a própria eliminação não tem tela nem pedido: a operação a atende pelo ciclo de vida, com o apelido do
      operador. Se virar pedido real, a migration amplia o check, e a prévia dela segue a regra do professor, sem contagem de uso
      (`conformidade-reviewer`, 1ª rodada da 11.0). Decidido na 15.0 como "fora do F3"; reabrir com o primeiro caso.
- [ ] **(F3, 15.0) VALIDATE do check do autor `rotina` em arquivo próprio antes do staging:** a 0036 grava `NOT VALID` e `VALIDATE` no
      mesmo arquivo (o `migrar` roda numa transação), e a `auditoria` é a tabela que mais cresce. A partir do staging, o `VALIDATE`
      de `auditoria_rotina_so_nas_acoes` vai em migration própria, fora do horário letivo, junto dos índices `concurrently`
      pendentes (Tech Spec do F3, seção 7c).
- [ ] **(F3, 15.0) Dois homônimos eliminados no mesmo minuto:** cada job lê o outro como ainda ativo e os dois ficam `homonimo = true`,
      sem troca. É o lado seguro; se aparecer caso real, a troca roda depois do primeiro (a lista de homônimos relida na etapa 3).
- [ ] **(F3, 15.0) `eliminar` com `NAO_ENCONTRADO` falha o job em vez de concluir:** a pessoa que sai por outro caminho entre a leitura
      e a trava faz a tentativa falhar uma vez (a etapa 3 desfaz), e a seguinte conclui. Raro, e sem efeito além de uma linha de
      `job.tentativa_falhou`; só tratar se o alerta de 48 h aparecer por isso.
- [ ] **(F3, 15.0) Mutações da 15.0 que ficam equivalentes sob a trava:** o `where estado = 'agendado'` do `concluir` do repositório da
      eliminação e a conferência do mesmo `agendado` em `travarVencido` já são garantidos pelo `FOR UPDATE`; ficam como segunda camada
      (a primeira é provada no isolamento por método, `eliminar-titular.int.test.ts`).
- [ ] **(F3, 15.0) `entidadeId` de `titular.nome_trocado` na leitura da coordenação:** a entrada de auditoria da troca guarda o id da
      execução e do consumo do aluno eliminado. Quando a consulta da auditoria for aberta à coordenação, ou o dossiê (D61) a exportar,
      esconder o `entidadeId` dessa ação ou agregá-la por pedido. Hoje nenhuma rota expõe a auditoria (`conformidade-reviewer`, 15.0, 1ª rodada).
      Na mesma consulta (F12), `titular.nome_trocado` também **não deve dizer qual professor escreveu o nome** que foi trocado
      (`conformidade-reviewer` da revisão da spec, recomendação que a 19.0 registra aqui).
- [ ] **(F3, 15.0) O check do autor `rotina` não exige `autor_usuario_id` em `entrega.decidida` e `lote.aprovado`:** o teste "outro
      operador assina qualquer ação" pede revisão se o check ampliar; o gatilho `entrega_decidida_por_da_equipe` já protege a decisão
      real. Muda o contrato da 0036 (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Autoria da conclusão em `docs/lgpd.md` e na tela do pedido (16.0):** quando a coordenadora que registrou foi
      desativada, `concluido_por` é dela e a auditoria diz `rotina`. A tela mostra o autor da auditoria, e não `concluido_por`; dizer
      isso em `docs/lgpd.md` na 16.0 (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) A entrega `pendente` continua `pendente` depois do job:** sem teste que o fixe; pede fixture de entrega e de artefato
      `pendente`. O job não decide entrega (regra 70, item 3) (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Erro tipado no `pedido de eliminação não concluído sob a trava`:** é `new Error` (regra 00, item 9). Invariante
      inalcançável sob a trava; tipar com `FalhaDeJob` muda a política de repetição do job e pede decisão (`revisor-geral`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) `origem: 'periodo'` na foto do professor eliminado:** o teste do professor não afirma o valor; depende de o cenário
      ter suboperador vigente para o período dele. O valor é provado em `compartilhamento.int.test.ts` (`privacy-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 16.0) Leitura de `GET pedidos/:id` depois do job, fim a fim pela API:** `titular: null`, `nomeTrocado` e o provedor na
      foto. É a 16.0 que lê esse DTO na tela (`test-engineer` e `privacy-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Texto de ano `encerrado` na troca de nome:** a troca não filtra por ano (é por escola), mas nenhum teste mostra uma
      linha de ano encerrado trocada; pede fixture de ano encerrado (`test-engineer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Cursor da troca de nome guardado por coluna no pedido:** a noite seguinte a uma interrupção recomeça da primeira
      faixa e só altera o que sobrou. Se a escola tiver tanto texto que a noite não alcança o fim, a coluna nova no pedido guarda o
      cursor (muda o modelo de dados; a causa 3 do runbook cobre o sintoma) (`infra-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Ordem de trava pedido → usuário contra o job de arquivo da 13.0:** travar todos os pedidos do titular logo depois
      de `travarVencido` evitaria uma inversão de ordem com o job do arquivo. Sem deadlock medido, e a fila repete (D49); muda a ordem
      de trava de `concluirOutrosAbertos` (`infra-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) `#examinar` da troca de nome converte o `jsonb` inteiro a cada faixa:** `octet_length(campo::text)` relê e converte as até 1.000 linhas, e a faixa cortada pelo orçamento relê o mesmo bloco várias vezes. Medido em 574 ms para 1.000 linhas de ~1 MB, dentro dos 2 s; rever com volume real no piloto (`pg_column_size`, ou `limit` menor depois de uma faixa cortada) (`infra-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Migration 0036 fora do horário letivo e com `lock_timeout`:** `auditoria` cresce com o aluno, e o `VALIDATE` do check do autor `rotina` a varre sob trava. Fecha junto do item da 0031, logo abaixo (`infra-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Consulta pronta na causa 6 do runbook da eliminação:** deixar escrita a consulta que devolve só `id` e `octet_length` da maior linha por tabela da escola, para quem opera não montar a query na hora e selecionar a coluna de texto (`privacy-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0 → 16.0) Registrador desativado entre a leitura e a faixa, na etapa 2 da eliminação:** a faixa falha e a tentativa seguinte assina como `rotina`; sem teste próprio. Entra com a 16.0, quando a tela mostrar o autor (`privacy-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Linha de ~4,9 MB do teste da guarda de bytes da troca de nome:** o teste `a linha sozinha acima do orçamento da faixa…` roda o regex numa faixa só contra o `statement_timeout` de 2 s (margem medida de cerca de dez vezes). Se ficar instável na esteira da spec, baixar a linha para pouco acima de 4 MB (`test-engineer` e `revisor-geral`, 15.0, 3ª rodada).
- [ ] **Migration 0031 fora do horário letivo (F3, 9.0):** `incidente_escola` tem FK para `usuario` e para `escola`, e o `migrar`
      roda numa transação. Antes do staging, aplicar fora do horário letivo e com `lock_timeout`, junto dos índices
      `concurrently` pendentes das migrations 0025 a 0027 (Tech Spec do F3, seção 7c).
- [ ] **Casos de borda do `citaOutraEscola` (F3, 9.0):** `apps/api/src/ops/incidente.test.ts` não fixa três casos em que o
      comportamento de hoje é o lado seguro (recusa): duas escolas do arquivo com o mesmo nome; "Escola Alfa" contra "Alfa Norte"
      num texto "Escola Alfa Norte"; o nome da própria com a fronteira quebrada ("Colégio Ametista Nortex"). Escrever os testes
      quando a função mudar.
- [ ] **(F3, 10.0) Faixa quando a leitura do aviso de incidente falha:** hoje, se `GET /v1/privacidade/incidentes` falha, a
      coordenação não vê aviso nem faixa (a aba Incidentes tem o erro com "Tentar de novo"). Mostrar uma faixa discreta, "Não foi
      possível conferir os avisos de incidente. Abra Privacidade › Incidentes", muda o comportamento da tela e o texto fica a
      decidir com o Gabriel (`frontend-reviewer` da 10.0).
- [ ] **(F3, 10.0) e2e da troca de escola com o aviso pendente na segunda:** a Tech Spec §9 e o comentário de
      `AvisoDeIncidente.tsx` dizem que a troca de escola desfaz o adiamento. O caso pede duas escolas e o segundo fator de novo, mais
      de um minuto de relógio, como `e2e/privacidade.spec.ts › a troca de escola não mostra a retenção…`; o reset do cache na troca
      já é provado ali, com a retenção (`test-engineer` e `revisor-geral` da 10.0).
- [ ] **(F3, 10.0) e2e do professor com incidente pendente na escola:** sem aviso, sem faixa e sem a leitura da lista. Hoje é
      estrutural (a área só monta para a coordenação, e a API recusa pelo papel: `apps/api/test/incidente.int.test.ts`, 9.0); passa
      a valer se alguém mover o aviso para a `CascaDaEscola` (`test-engineer` da 10.0).
- [ ] **(F3, 10.0) "Ficam registrados quem confirmou e quando" sem tela do "quem":** o texto de `TEXTO_DO_QUE_CONFIRMAR_FAZ` promete
      um "quem" que a coordenação não lê em tela nenhuma. Dizer onde ele aparece quando a tela de auditoria da escola existir
      (`privacy-guardian` da 10.0).
- [ ] **(F3, 10.0) Semente de incidente da vitrine:** a foto da tela de incidentes semeia o aviso por SQL solto. Se virar script em
      `tools/vitrine/`, manter texto inventado, sem dado de pessoa (`privacy-guardian` da 10.0).
- [ ] **Prazo do `registro_de_decisao` (F3, 5.0):** `packages/shared/src/privacidade/retencao.ts` (`PRAZOS_FIXOS.registro_de_decisao`) promete à escola «enquanto durar o contrato com a escola, e mais 5 anos», mas o `expurgo_execucao` apaga o registro 5 anos depois de `em`, com o contrato valendo. O registro não tem dado de pessoa (só contagens e ids), então o risco é baixo. Decidir (Joaquim): alinhar o texto ao que o código faz, ou dar ao registro do expurgo uma linha própria em `PRAZOS_FIXOS` (`privacy-guardian` da 5.0)
- [ ] **Thread do Assistente apagada pelo expurgo no instante do envio (F3, 3.0):** a thread vazia e vencida que o expurgo
      apaga enquanto o professor manda a primeira mensagem faz o envio falhar pela FK. Conferir que ele vê um erro tipado e
      que pode reenviar, e não um 500 (`infra-guardian` da 3.0). A seleção da thread vazia filtra `(escola_id, criada_em)`
      pelo índice único da thread, sem índice próprio: rever se a tabela crescer (`revisor-geral` da 3.0)

- [ ] `lista_nome`: índice parcial `(escola_id, usuario_id) where usuario_id is not null`, para a busca da eliminação do
      aluno aprovado (`CicloDeVidaRepository.apagarDaListaDeNomes`) e a FK do `usuario_id` no `delete` do usuário; hoje as
      duas percorrem a lista da escola pelo prefixo de `lista_nome_turma_idx`. Na próxima migration de `lista_nome`
      (`infra-guardian` da 10.0 da A1)
- [ ] Expurgo do `acesso_turma` e do `convite`: `order by least(...)` sem índice; se o "Gerar novo" virar rotina diária por
      turma, um índice de expressão pelo prazo (`infra-guardian` da 10.0 da A1)
- [ ] Encerrar o ano segura, durante a virada, a sala da escola inteira (reivindicação, decisão, lista e acesso esperam o
      `FOR SHARE` do ano): uma linha no runbook e o aviso na tela de Estrutura (13.0) de não encerrar em horário de aula, e a
      duração da virada num log só com contagens (`infra-guardian` da 10.0 da A1)
- [ ] **Índice da lista de professores**: `GET /v1/professores` (A1, 3.0) pagina `usuario` pelo índice `(escola_id, id)` e
      descarta quem não é `professor`: cada página pode ler todos os usuários da escola, alunos inclusive. Barato hoje
      (rota rara, só da coordenação, escola de mil usuários). Com escolas maiores, um índice parcial `(escola_id, id) where
      papel = 'professor'`, conferido com `EXPLAIN` sobre o seed de uma escola grande (`infra-guardian` da 3.0)
- [ ] **Eliminar escola apaga também o resto de uso dela**: a pasta vazia `escolas/<id>/` (o SeaweedFS só a tira da listagem
      com o `DeleteObject` da própria pasta) e os contadores `uso:*:<id>:*` do Redis de fila. Hoje a consolidação pula e conta
      essa escola toda noite como `escola_inexistente` (correção `2026-09-25-consolidacao-para-na-escola-inexistente`), e o
      sinal fica misturado com o caso que o runbook manda investigar (banco errado, restauração pela metade). Desde a correção
      `2026-09-25-acabamento-da-a0b`, se todas as escolas encontradas numa noite forem eliminadas (uma noite sem requisição
      de escola nenhuma basta), o resto de uso também derruba o job (`uso.nenhuma_escola_no_banco`). Vai na spec da
      eliminação (`privacy-guardian` e `infra-guardian` da correção)
- [ ] Alerta para muitos `login.externo{resultado="provedor"}` (erro, prazo ou discovery do Google ou da Microsoft), com linha no runbook: hoje a métrica existe, mas nada avisa quando o login pela conta da escola começa a falhar em massa (revisão da 13.0)
- [ ] Login pela Microsoft: passar a exigir a claim `xms_edov` (e-mail de domínio verificado) para ligar professor pelo e-mail. Hoje o e-mail vale como verificado porque o tenant já foi conferido, como a Tech Spec define; com a claim, um administrador do tenant da escola não consegue pôr o e-mail de outra professora num usuário e ligá-lo à conta dela (revisão da 13.0)

- [ ] **Reescrever o passo de `docs/runbook.md:276`, que é impossível de seguir.** Ele manda "olhe a
      borda (`docker compose logs --since 10m borda`)" para descobrir de onde vem uma varredura de
      endereço de escola — mas o log da borda não tem, e **por desenho não pode ter**, IP nem URL de
      requisição (regra 20, item 9; `infra/Caddyfile` exclui `http.log.access`, `http.log.error`,
      `reverse_proxy` e `admin.api`). Quem opera chega num beco. O conserto é dizer onde a informação
      está de verdade (o registro de acesso da aplicação, `docs/lgpd.md:76`), **nunca** religar log de
      requisição na borda. Achado pelo `infra-guardian` na correção
      `2026-09-22-log-da-borda-afogado-pela-sonda-do-proprio-container`

- [ ] **`infra/scripts/ensaio-alertas.ts:404` recria `api-1` e `api-2` com `--force-recreate`**, e as duas
      publicam porta (`infra/compose.yml:197,211`). É a mesma classe da corrida de porta corrigida em
      22/09/2026 (`tasks/correcoes/2026-09-22-corrida-de-porta-na-observabilidade.md`), e o que segura o
      item é só isto: **não há vermelho medido** ali. Nenhuma atenuante de desenho o distingue — o
      `up --force-recreate` do ensaio sobe o novo sem esperar o anterior soltar a porta, exatamente como
      o que foi consertado. Se aparecer, o conserto é o mesmo `recriarDoZero` de
      `tools/testes/compose.ts`, com um invólucro para a assinatura do ensaio, que leva a sobreposição
      de ambiente na frente (`(...argumentos) => composeCom(sobreposicao, ...argumentos)`). Apontado
      pelo `test-engineer` na correção

- [ ] **Recontar o número de linhas do docstring de `tools/ci/compose.ts`** quando a correção do
      `--tail` for aberta. Ele diz que os cinco logs de terceiro truncados somam 149.322 linhas; com o
      ruído do `admin.api` fora, cai para algo em torno de 115 mil — mas isso é **subtração, não
      medição**, e o `infra-guardian` exigiu recontagem numa execução real antes de mexer na régua

- [ ] Pôr `--timestamps` no despejo de log de `infra/scripts/carga.ts:304` e
      `infra/scripts/carga-login.ts:444`, que ainda usam `logs --no-color --tail 100`. É o mesmo
      defeito da correção `2026-09-21-log-da-falha-sem-carimbo-de-hora`, que consertou só os dois
      scripts da esteira; o padrão certo já existia no despejo de
      `aguardarSaudavel` (`tools/testes/compose.ts`). Sem carimbo
      uniforme, o log de um ensaio de carga não cruza com o instante do que falhou

- [ ] **Job `infra` da esteira perto do teto, sem guarda.** Leva de 29 a 30 min desde `3aeec3b` (tarefa 9.0 da A1),
      contra 22 a 23 min antes (30 min na execução 37001095812, do commit `241ba1c`); o teto é de 45 min e nenhuma
      guarda liga o tamanho da suíte a ele, como a de `tools/ci/esteira.test.ts` passou a fazer com o e2e. E os
      comentários que dizem quanto ele leva venceram: "uns 11 min" e "uns 16 min" em `.github/workflows/ci.yml:54-55`,
      e "uns 16 min" em `vitest.config.ts:7`, `README.md:60` e `.claude/rules/40-testes.md:102`. Na mesma correção, a
      frase do `docs/runbook.md` ("Esteira vermelha no e2e") que diz que a guarda do teto "reprova no portão local":
      está certa e incompleta, porque o teste é de unidade e reprova também no job `verificar` (`test-engineer` e
      `infra-guardian` da correção `2026-10-02-teto-do-e2e-na-esteira`). Destino: correção própria por `/corrigir`,
      antes da próxima tarefa que acrescentar teste com espera de relógio em `infra/**/*.int.test.ts`

- [ ] **`npm ci` das imagens na esteira sem nova tentativa.** Em 12/10/2026 o job `e2e 3/4` caiu duas vezes na
      construção das imagens, antes de qualquer teste, com `npm error code ECONNRESET` e `network aborted`: na
      execução 38261610727, 1ª tentativa (`4956a51`; imagem `despachante`, `npm ci --omit=dev`), e na 38279991501,
      1ª tentativa (`bbae49e`; imagem `worker-lote`, `npm ci --ignore-scripts`). A segunda passou na 2ª tentativa sem
      mudança de código. Os seis `RUN npm ci` de `infra/docker/servico.Dockerfile` (um no `base`, um em cada alvo de
      produção e um na `web`) rodam uma vez só, e a esteira constrói as imagens do zero em cada
      job que sobe o compose (`up --build`, `tools/ci/prazo-do-e2e.ts:143`): uma queda de rede do registro derruba o
      job e custa uma reexecução à mão, com a esteira vermelha no meio. Saídas, a medir numa correção por `/corrigir`
      (`infra-guardian`): `fetch-retries` e `fetch-retry-maxtimeout` do npm maiores nesses `RUN`; cache do npm no
      BuildKit (`--mount=type=cache`), com cache de camada na esteira; ou nova tentativa da construção em quem a
      chama. Nenhuma pode esconder falha que não é de rede: a nova tentativa vale só para erro de rede, com teto, e
      deixa a linha no log. O `npm ci` dos próprios jobs (`.github/workflows/ci.yml:34,50,67,97`) tem o mesmo risco,
      e `tools/ci/esteira.test.ts:130` fixa os comandos de cada job
- [ ] **`imagensDosServicos` com compose vazio ou sem `services`.** `tools/ci/compose.ts` lê o compose por
      `parse(texto, { merge: true })`, que devolve `null` para texto vazio e `undefined` para a chave que falta; a
      desestruturação quebra com `TypeError` em vez de dizer qual arquivo veio sem serviços. Hoje todo chamador passa
      `infra/compose.yml`. Quando algum passar outro compose: erro explícito com o nome do arquivo, com teste e
      mutação próprios (achado do `infra-guardian` na 1ª rodada da 90.0)

**Ao ligar HTTPS na borda do staging, as quatro coisas abaixo são da mesma tarefa.** Estão separadas
porque item único vira execução parcial. Motivo e medição de cada uma em
`tasks/correcoes/2026-09-22-log-da-borda-afogado-pela-sonda-do-proprio-container.md`, seção "O que fica
para o staging".

- [ ] Acrescentar **`http.stdlib`** ao `exclude` do `log default` em `infra/Caddyfile`. É o único vetor
      restante de endereço de cliente no log da borda, e ele vai **dentro do `msg`**
      (`"http: TLS handshake error from <ip>:<porta>"`), sem chave — cego às negativas por nome **e** à
      negativa por forma. Em HTTP/1 sem TLS não dispara (medido); com TLS, dispara. E no staging o log
      do Docker vai para o Alloy e o Grafana Cloud (`notas-staging.md:53,55`), o que torna a linha dado
      retido e pesquisável. **Não** excluir o logger pai `http` no lugar dele: a exclusão por prefixo
      não arrasta filho (medido com `admin`/`admin.api`), e excluir `http` seria pior
- [ ] **Converter** a negativa por forma de `infra/test/borda.int.test.ts` em asserção **positiva**
      sobre os campos que o log de acesso passa a guardar. Apagá-la reabre a família de cinco
      armadilhas que a correção fechou
- [ ] Somar **`user_id`** e **`resp_headers`** à lista de chaves proibidas nesse momento. A âncora atual
      (`"(remote_ip|...)":`) não pega `resp_headers`, porque exige que o grupo comece logo depois da aspa
- [ ] Trocar o guarda de texto de `tools/ci/borda.test.ts` por um `toEqual` sobre `logging.logs` do
      `caddy adapt`, que é imune à formatação do arquivo (espaço, tabulação, coluna 0, CRLF, bloco
      aninhado) e mostra a configuração **efetiva** — inclusive o `health_checker` que o próprio Caddy
      acrescenta ao `exclude`. Roda em `test:infra`, não no portão rápido: custa o binário do Caddy

- [ ] **Onde este arquivo diz "staging", vale a VM de produção do F18** (D31 revista em 24/10/2026): o item
      "antes do staging" vale antes da produção na VM. O provedor de nuvem, com Postgres + pgvector, Redis e storage
      S3 gerenciados (D26, D28), é escolhido na migração para a AWS (D42). O Redis da VM fica na mesma máquina da
      API, e o corte de 100 ms do cliente do login é ensaiado nela (`infra-guardian`)
- [ ] **Bloqueio de IP na borda contra ataque ao código da turma** (A1): na A1 não existe, e a resposta é revogar os
      acessos da escola (`docs/runbook.md`, "Código da turma errado em massa numa escola"). Entra com o staging e o
      provedor (D42), com finalidade e prazo de remoção no `docs/lgpd.md` antes do primeiro uso, na regra do provedor
      e nunca em arquivo versionado (o repositório é público), sem ler as chaves `rl:ip` à mão (`privacy-guardian`)
- [ ] **Valores que o staging e a produção não herdam do `.env.example`**, e que fazem o boot falhar
      de propósito se forem copiados. Hoje são três, e a lista é executável em `apps/api/src/config.test.ts`
      ("o .env.example não sobe em produção"), que falha quando outra variável entra na mesma classe:
      `LOGIN_REDIS_PRAZO_MS` (no máximo 100; o exemplo tem 2000, que só vale em `local`) e os dois
      emissores do login pela conta da escola, `LOGIN_EXTERNO_GOOGLE_EMISSOR` e
      `LOGIN_EXTERNO_MICROSOFT_EMISSOR`, que apontam para o `oidc-falso` em http e precisam de https.
      Em produção soma a quarta, `ROTAS_SINTETICAS`, que o exemplo deixa ligada.
      **A lista é do que o boot recusa, e é a parte fácil.** A perigosa é o que ele *aceita*:
      `IDENTIDADE_CHAVE_ASSINATURA`, `LOGIN_CHAVE_CONTADOR`, `IDENTIDADE_CHAVE_CIFRA_V1` e os segredos
      do login externo têm 32+ caracteres e sobem em produção sem reclamar, sintéticos como estão. A
      lista de criação do staging precisa das duas metades (`test-engineer`).
      E, sob pressão, a saída errada é baixar o `AMBIENTE` para `local`, que destravaria junto
      `LOGIN_PROTECAO_DESLIGADA` e `ROTAS_SINTETICAS`: escrever isso na lista antes de alguém
      precisar dela (`infra-guardian`)
- [ ] Tirar `MONTAGEM_DE_TESTE.prazoDoRedisDeLoginMs`, que ficou quase redundante com
      `LOGIN_REDIS_PRAZO_MS`: os dois valem 2 s no compose de teste, e por isso a precedência do `??`
      em `sessao.module.ts` não tem teste que a prove. São sete arquivos de teste, mecânicos — era
      limpeza fora do escopo da correção de 22/09 (`test-engineer`, rodadas 3 e 4)
- [ ] Contrato com provedor de modelo: **garante processamento no Brasil para conversa de
      aluno** (D62), veda treinamento, permite serviço usado por menor,
      limite de tokens por minuto compatível com o pico (~1,5 mi/min em 10 escolas pela
      estimativa do `docs/infra.md`; a análise de 13/09/2026 chegou a ~2,8 mi com premissa
      mais realista), e região de processamento (D29)
- [ ] Provedor de modelo de reserva configurado e testado
- [ ] Antes da primeira escola real: alerta para rotina do sistema que parou de rodar
      (`sistema.consolidar-uso`, `sistema.expurgar-jobs`, `sistema.expurgar-acesso` da 17.0), por exemplo métrica com o horário do
      último sucesso e regra `time() - x > 26h`, com entrada no `docs/runbook.md` (pendência da 11.0
      registrada na 13.0; dono: Joaquim). Precisa pegar também a rotina que roda e falha: a consolidação falha com
      `uso.nenhuma_escola_no_banco` quando o worker aponta para o banco errado (correção `2026-09-25-acabamento-da-a0b`),
      e hoje isso só aparece em `job_registro`
- [ ] Rodar a avaliação de `docs/avaliacao-de-modelos.md` com Maritaca e Gemini (D37)
- [ ] Perguntar à Maritaca, por escrito, se o contrato cobre dado de aluno menor de idade e
      se garante processamento só no Brasil (o DPA de agosto/2026 lista Brasil, EUA e UE)
- [ ] Verificar os termos do Vertex AI para serviço usado por menor e se processa em São
      Paulo (a Gemini API do AI Studio veda esse uso)
- [ ] Com contador: tributo sobre IA faturada do exterior contra faturamento local, e regime
      tributário (Simples com fator R, Lucro Presumido, CBS de 2027)
- [ ] Levantar a região de processamento dos provedores e se a rede pública aceita
      transferência internacional de dado minimizado
- [ ] Escolher ferramenta de observabilidade e de alerta no celular (região Brasil ou
      hospedada por nós)
- [ ] Levantar com a escola piloto: horário letivo real, banda da rede, se há proxy ou
      filtro de conteúdo que bloqueie WebSocket
- [ ] Antes do piloto: canal e texto para avisar as escolas de incidente
      (`docs/runbook.md:198`, pendência da validação do F0)
- [ ] Validar a FK de `escola_id` das tabelas do F0, numa migration de deploy fora do horário
      letivo (regra 80, item 9). A migration 0006 acrescentou as três restrições `NOT VALID`:
      elas já barram escrita nova, mas as linhas anteriores ao F1 nunca foram conferidas.
      Antes de rodar, esta consulta precisa dar zero em cada tabela:

      ```sql
      select 'job_registro' as tabela, count(*) from job_registro j
        where j.escola_id is not null and not exists (select 1 from escola e where e.id = j.escola_id)
      union all select 'configuracao_operacional_escola', count(*) from configuracao_operacional_escola c
        where not exists (select 1 from escola e where e.id = c.escola_id)
      union all select 'uso_infra_diario', count(*) from uso_infra_diario u
        where not exists (select 1 from escola e where e.id = u.escola_id);
      ```

      Com zero, a migration é `ALTER TABLE <tabela> VALIDATE CONSTRAINT <nome>_escola_id_escola_id_fk`
      nas três, uma por vez (dono: Joaquim)

- [x] **A página pública da sala só com a 7.0 junto** (A1, tarefa 5.0; `infra-guardian` e `privacy-guardian`). Feito na
      7.0: o contador de código errado por escola com a espera de 1 s, o de matrícula errada por nome e o de hash sem pedido
      por turma (`apps/api/src/sala/limites-da-sala.ts`). O alerta e o comando de revogar ficam na 9.0. Até a
      7.0, a busca pelo código em `salas/abrir` só tem o `rl:ip` anônimo, e quem sabe o slug de uma escola pode tentar
      códigos de vários IPs para listar os nomes livres. Nenhum staging exposto nem dado real sem o contador de código
      errado por escola e a espera de 1 s da 7.0 (dono: Joaquim, no portão do staging). O mesmo vale para
      `salas/reivindicar` (6.0): até o contador por nome da 7.0, quem tem um código válido pode tentar matrículas num
      nome livre, e cada tentativa só custa um hash, segurado pelo `rl:ip` e pela vez da escola no semáforo
      (`infra-guardian` e `privacy-guardian` na 6.0)
- [ ] **`rl:ip:sala` próprio** (Tech Spec da A1, 7c; `infra-guardian` na 5.0): `salas/abrir` divide o `rl:ip` anônimo
      com as outras rotas anônimas, e a folga (cerca de 1.300/min contra 3.000/min) vale para uma escola. Gatilho: rede
      com várias escolas atrás do mesmo IP de saída, ou o F2, o que vier antes (dono: Joaquim)
- [ ] **Prender o `AcessoDaSala` ao `sala` no teste de arquitetura** (`privacy-guardian` na 5.0): ele sai do
      `SessaoModule` global, e só o `SalaModule` deve injetá-lo, porque abre contexto de escola sem usuário. A 5.0
      exigia o `arquitetura.test.ts` sem mudar; a asserção entra na próxima tarefa que tocar o teste, e prende também o
      `anoLetivoId` de `naEscolaSemUsuario` a `sessao/tenant/acesso-da-sala.ts`, o único caminho que põe o ano no contexto sem
      usuário (`privacy-guardian`, 2ª rodada) (dono: Joaquim)
- [ ] **Alinhar os pacotes `@nestjs/*` na mesma versão** (`infra-guardian` na correção
      `2026-10-06-audit-proxy-addr-e-multer`): o `@nestjs/platform-express` subiu para 12.1.2 para fechar o aviso do
      `multer`, e `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-socket.io` e `@nestjs/websockets` ficaram em
      12.0.1. Funciona porque o que a 12.1.2 importa de `@nestjs/common/internal` existe na 12.0.1, mas esse módulo é
      interno do Nest, e um `npm update` de um lado só pode quebrar sem aviso de peer. Daqui em diante os pacotes do Nest
      sobem juntos; o alinhamento entra na próxima tarefa que tocar dependência (dono: Joaquim)
- [ ] **(F3, 18.0) A releitura de 10 s de "Meus dados" não tem teto de tentativas** (`frontend-reviewer`, 1ª rodada): o relógio é
      o `agendarRelitura` da 16.0, compartilhado com a tela da coordenação; teto ou espaçamento crescente é decisão dos dois
      usos, pela regra 80 (dono: Joaquim)
- [ ] **(F3, 20.0) `INTERVALO_DA_ATIVIDADE_MIN` copiado em dois specs de e2e** (`test-engineer` e `revisor-geral`, 1ª rodada):
      `e2e/acesso-suspenso.spec.ts` e `e2e/inatividade.spec.ts` repetem o 5 min do relógio de inatividade, que vive em
      `apps/web/src/sessao/inatividade.ts` (importa React e `api/sessao`, e não carrega no Node do Playwright). Vale quando a
      constante for para `packages/shared` (dono: Joaquim)
- [ ] **(F3, 20.0) Teste de `deveTentarDeNovo` com `ACESSO_SUSPENSO`** (`infra-guardian`, 1ª rodada): a garantia de "nenhuma nova
      tentativa" depende só da lista fechada de códigos de `apps/web/src/api/cliente-de-consultas.ts`; um teste dela, com
      `ACESSO_SUSPENSO`, a prende. O arquivo não é da 20.0: a tarefa que o tocar cobre (dono: Joaquim)
- [ ] **(F3, 20.0) Componente comum para `SemDesafio` e `AcessoSuspenso`** (`revisor-geral` e `frontend-reviewer`, 1ª rodada): o
      link "Ir para a entrada" e o aviso com o token `pendente` se repetem nas duas telas; um componente comum, ou um
      token/variante "aviso", vale quando houver uma terceira tela igual (dono: Joaquim)
- [ ] **(F3, correção da ordem da lista de pedidos) `ne(titularId)` sem teste que o distinga da exclusão pela conta**
      (`test-engineer`, `privacy-guardian`, `tenancy-guardian` e `revisor-geral`, 1ª rodada): em
      `apps/api/src/privacidade/pedidos.repository.ts`, `listar`, a cláusula `ne(pedidoTitular.titularId, deQuemPediu.usuarioId)`
      apagada deixa tudo verde, porque a exclusão pela conta cobre o mesmo caso; só se distinguem quando quem lê não tem
      `conta_id`, e `escolaComPessoas` não semeia isso. Falta um caso de integração com quem lê sem conta, para a cláusula não
      sair por engano. A cláusula é da 11.0 e não é do diff da correção. Momento: validação do F3 (dono: Joaquim)
- [ ] **(F3, correção da ordem da lista de pedidos) Índice `(escola_id, chegou_em, id)` em `pedido_titular`**
      (`infra-guardian`, 1ª rodada): a página de pedidos ordena por `(chegou_em desc, id)` sem índice próprio, sobre os pedidos
      de uma escola (dezenas por ano). Se o volume de rede pública mostrar custo, é migration de expansão só com o índice.
      Gatilho: `EXPLAIN` com dado sintético no volume de rede pública (dono: Joaquim)
- [ ] **(F3, validação, rodada 2, m1) Pedido registrado depois do encerramento do ano, por tipo:** em
      `apps/api/test/pedido-titular.int.test.ts:1061` o caso registra só um pedido de compartilhamento, e o e2e, um de
      correção. Nenhum teste registra eliminação, acesso ou portabilidade com o ano `encerrado`; o `Validador` conferiu os
      três à mão pela API. Acrescentar uma eliminação e um acesso ao caso, na próxima correção ou tarefa que mexer nos
      Pedidos (dono: Joaquim)
- [ ] **(F3, validação, rodada 2, m2) "Sem turma neste ano" quando não há ano em curso:**
      `apps/web/src/areas/coordenacao/privacidade/textos-dos-pedidos.ts:58`. "Sem turma" basta. Na próxima correção ou
      tarefa que mexer nos Pedidos (dono: Joaquim)
- [ ] **(F3, validação, m3 a m6) Telas da Privacidade:** o m3 foi feito na tarefa 12.0 da X2 (`telas-da-coordenacao`): a lista de
      pedidos tem a coluna "Prazo" e o vencido diz "vencido há N dias". O m6 foi para a X1 (tarefa 11.0, título visível em toda
      tela); o m4 e o m5 pedem campo no DTO e continuam sem spec: o m4 na próxima tarefa que mexer em `packages/shared/src/privacidade/titular.ts`, e o m5 na próxima que mexer em `AcoesDoPedido.tsx` (dono: Joaquim).
      (m3, feito) a lista de pedidos não mostrava o prazo nem destacava o vencido: a correção vencida há 5 dias aparecia só como
      "Recebido"; (m4) o DTO do pedido não leva `eliminarEm` (`packages/shared/src/privacidade/titular.ts`), e o detalhe diz
      "7 dias depois do registro" sem dizer o dia; (m5) "Baixar a versão da escola" aparece também com o titular de conta
      ativa, e aí sempre falha, com o texto certo (`AcoesDoPedido.tsx:279`); (m6) na área do professor, "Meus dados" não tem
      título à vista (`apps/web/src/componentes/meus-dados/MeusDados.tsx:189-191`). Fotos e detalhe em
      `tasks/prd-lgpd-e-titular/validacao.md`, seção 4 das duas rodadas (dono: Joaquim)
- [ ] **(X2, 12.0) A lista de pedidos mistura dois formatos de data na mesma linha:** "Chegou em" diz "14 de outubro de 2026" e o
      prazo diz "até 29/10/2026" (`textoDoPrazo`, em `apps/web/src/areas/coordenacao/privacidade/textos-do-pedido.ts`). O
      formato curto é o do prazo em toda a Privacidade, e mudar o texto mexe nos testes e nos e2e que o afirmam. Na próxima
      tarefa que mexer em `textos-do-pedido.ts` (dono: Joaquim)
- [ ] **(X2, 6.0) Três recomendações que a tarefa deixou para depois:** (a) o selo da situação na tabela de Professores diz a
      frase inteira de `TEXTO_DO_ESTADO_DO_PROFESSOR`; selos curtos ("Ativo", "Convite em aberto", "Convite vencido"), com
      a frase no painel, mudam o texto de tela e o que o e2e confere, e a 6.2 manda esse texto na tabela (o Arquiteto decide
      com o mockup 3.6); (b) a barra de abas de `Estrutura.tsx` a 360 px derruba "Material" para a segunda linha; (c) o
      clique duplo no nome da linha pode empilhar dois passos iguais no histórico (`abrirPainel` em `Professores.tsx`),
      risco baixo, cobertura extra; (d) no caso dos homônimos de `Professores.test.tsx` o id sai de
      `localizacao.history?.at(-1) ?? ''`, e com o histórico vazio o teste falha sem dizer por quê: uma asserção de que o
      endereço contém `professor=` antes de ler o id (na próxima tarefa que tocar o arquivo, a 7.0); (e)
      `e2e/lista-da-turma.spec.ts:646` devia conferir que o painel daquele professor abre antes do `goBack`, já que o
      link da turma passou a levar ao painel (spec da 9.0); (f) `e2e/professores.spec.ts:1108`: o `toHaveCount(0)` logo
      depois do `goBack` pode passar antes de um painel reabrir, e uma espera curta pelo título da lista deixaria a
      intenção clara (dono: Joaquim)
- [ ] **(X2, 7.0) Recomendações que a tarefa deixou para depois:** (a) o vazio "Crie uma turma primeiro" do painel do professor
      não diz onde criar a turma, e "Nenhuma turma." poderia convidar ("Nenhuma turma ainda. Use Acrescentar turma."),
      só quando o botão existe: um link para a aba Turmas fecha o próximo passo; é texto e caminho de tela, que o
      Arquiteto decide, junto com a 8.0 (`frontend-reviewer`, 1ª rodada; `PainelDoProfessor.tsx` e
      `o-que-falta-para-alocar.ts`); (b) o selo do vínculo do painel repete o de `ProfessoresDaTurma.tsx`, mudando só os
      textos: uma peça só, recebendo o mapa de textos, e o ternário que repete `<Estado>` em `SeloDoVinculo` pede um
      comentário de uma linha ou o tipo corrigido (`revisor-geral`, 1ª rodada; mexe na lista da turma e refaz os blocos
      de mutação do selo); (c) o selo "ATIVO." sai com ponto final, vindo de `convite-de-professor.ts` na 6.0
      (`frontend-reviewer`, 1ª rodada); (d) o e2e do contestado não confere o complemento que o professor escreveu: estender
      `contestarVinculosNoBanco` para gravá-lo (`test-engineer`, 1ª rodada); (e) `dialogo-modal.ts:26` e `dialogo-modal.test.ts:31` ainda dizem que o miolo do painel é `tabIndex={-1}`, fora da ordem do Tab (hoje é `tabIndex={0}`): tirar "o miolo do painel" dos dois comentários (`revisor-geral` e `test-engineer`, 2ª rodada); (f) o caso "abrir de novo com o diálogo ainda aberto é uma abertura nova" de `PainelDoProfessor.test.tsx` só funciona no jsdom, onde o fundo não fica inerte: o nome deveria dizer que prova a garantia defensiva da `key`; e o bloco de mutação `if (falhou !== undefined)` poderia trocar por `if (false)`, para o vermelho vir só da regra (`test-engineer`, 2ª rodada)
- [ ] **(X2, 8.0) Recomendações que a tarefa deixou para depois:** (a) a tabela de Material não tem o teto de linhas com
      "Mostrar mais" que a Tech Spec §7 prevê (`frontend-reviewer`, 1ª rodada); (b) a barra de abas da Escola quebra em duas
      linhas no celular, nas três abas: é da moldura (`frontend-reviewer`); (c) o texto de "sem disciplina na escola" cita
      "Escola › Turmas" sem link: pede navegação, que o Arquiteto decide (`frontend-reviewer`); (d) o "Tentar de novo"
      de um material que falhou troca o antigo pelo novo com um segundo pedido e engole o erro da exclusão: a API deveria
      fazer a troca numa operação só, com auditoria ligando os dois, e a tela avisar se a exclusão falhar (`privacy-guardian`;
      muda o contrato da API); (e) o texto de conflito do envio em `material-envio.ts` diz "lista abaixo" com o formulário
      num diálogo, e `origemDoMaterial` e o ramo `'Falhou'` de `textoDoEstado` são código morto: acertar na próxima tarefa
      que abrir esse arquivo (`revisor-geral`); (f) `fila-da-coordenacao.ts:121` escreve `'material'` à mão em vez de
      `PARAMETRO_DO_MATERIAL` (`revisor-geral`); (g) a 360 px o campo "De quem é o material" não comporta a opção "Material de
      autoria de professor da escola" (42 caracteres) numa linha só: o texto fica cortado no celular; encurtar o nome em
      `NOME_DA_TITULARIDADE` (`packages/shared`) ou deixar o campo quebrar linha (dono: Joaquim e Gabriel). Ao
      corrigir, o e2e "cabe inteiro" passa a medir também no `celular` e muda de nome (hoje sai no celular e
      mede só a largura do computador); (h) uma recusa que chega depois da troca de sessão ainda pode entrar na
      tabela de quem entrou depois: pede um contador de sessão no `Material` e um caso de teste (`privacy-guardian`, 2ª); (i) o comentário de `Material.tsx` sobre a troca de sessão cita "regra 20, item 15"; a
      justificativa certa é a regra 10 e o RF14 que `sessao.ts` já cita (`privacy-guardian`, 2ª); (j) as escolas
      da vitrine não têm material: o Validador fotografa a tabela com linhas e o painel no fim da spec
      (`frontend-reviewer`, 2ª); (k) `techspec.md` §7 ainda diz que Material tem teto de linhas com "Mostrar
      mais": ajustar no próximo commit de documento da spec (`revisor-geral`, 2ª); (l) ajustes de teste: o bloco
      de `abrirPainel` pode manter o id e acrescentar o título; o "+24" do e2e "cabe inteiro" é estimado e só se
      mede de outro jeito se ficar instável; o teste de troca de sessão usa um `vi.mock` que guarda os ouvintes,
      e sairia se `api/sessao` tiver função pública que dispare a troca (`test-engineer`, 2ª)
- [ ] **(F3, validação, m7) `IA_LATENCIA_FALSA_MS` obrigatória sem aviso no `README.md`:** `infra/compose.yml:211` exige a
      variável, e quem sobe o compose pela primeira vez não é avisado. Uma linha no `README.md` (dono: Joaquim)
- [ ] **(F3, validação, m8) A vitrine não semeia nada da Privacidade:** `tools/vitrine/escola.ts` monta a escola sem pedido,
      incidente nem empresa, e o `Validador` semeou à mão, nas duas rodadas, para fotografar as telas. Junta-se à semente de
      incidente da 10.0, acima: texto inventado, sem dado de pessoa (dono: Joaquim)
- [x] ~~(F3, fechamento) "Critério de conclusão" com as caixas em branco em documentos de tarefa~~ — resolvido na
      retrospectiva do F3 (11/10/2026): eram oito documentos, não três, e a seção saiu do modelo de tarefa
      (`tasks/prd-lgpd-e-titular/retro.md`, proposta 5). Os documentos antigos ficam como estão
- [ ] **(F3, fechamento) Comentários que falam em "grupo Conformidade":** `apps/web/src/areas/navegacao.ts:38` e
      `apps/web/src/caminhos.ts:80` descrevem um grupo que a lateral não tem (a decisão dos grupos está em "Marca e
      interface", abaixo, até o PRD do F12). Acertar o comentário na próxima tarefa ou correção que abrir esses arquivos
      (dono: Joaquim)

## Processo e dívida do F0

- [x] **(F3, retro, M1) O portão da tarefa confere as mutações:** feito em 11/10/2026 (D79,
      `tools/processo/mutacoes.ts`). Medido no térreo: três mutações, uma delas de integração, somaram 15 s ao portão.
      Falta a prova numa tarefa inteira: quantas reprovações do `test-engineer` ele evita
- [x] **(F3, retro, M2) Fuso nos testes:** feito em 12/10/2026
      (`tasks/correcoes/2026-10-12-fuso-nos-testes.md`). A unidade roda em `TZ=Asia/Tokyo` (`vitest.config.ts`); o
      vermelho de `textos-do-pedido.test.ts` era do teste (13 h e 18 h de UTC são o mesmo dia só em São Paulo); o
      Postgres do compose declara `timezone=America/Sao_Paulo` na linha de comando (`POSTGRES_FUSO`, no `.env.example`),
      e `tools/testes/fuso.test.ts` e `fuso.int.test.ts` provam a unidade e o banco vivo. Ficam de fora, de propósito:
      o fuso da **integração** (herda o do computador; fixar um longe de -03 ali é um lote vermelho que ninguém mediu),
      o do `compose.carga.yml` (troca o `command` inteiro) e o dia que a web mostra, que é o do navegador
      (`formatarDiaDoInstante`) e, se virar o de São Paulo, é decisão de produto. **Falta, no staging (D42):** o Postgres
      gerenciado (D26) costuma vir em UTC; declarar nele `timezone=America/Sao_Paulo`, para o banco que a escola usa seguir o
      mesmo dia do banco em que o teste roda. Sem isso, o `check` de `pedido_titular.chegou_em` (`0032_pedido_titular.sql`)
      aceita, entre 21 h e meia-noite, um dia de São Paulo à frente (a API recusa antes: `privacidade.service.ts`), e
      um `current_date` ou `::date` que entre sem fuso declarado muda de dia na produção sem o teste ver (dono: Joaquim)
- [x] **(F3, retro, M4) Condição de tela provada sem navegador:** feito em 12/10/2026
      (`tasks/correcoes/2026-10-12-teste-de-componente.md`). `jsdom` e `testing-library` entram como dependência de
      desenvolvimento do `@educa/web`, e o projeto `unidade` passa a incluir `*.test.tsx`: o portão da tarefa, a esteira
      e as mutações já o alcançam. O arquivo pede o ambiente na primeira linha (`// @vitest-environment jsdom`), e a
      unidade da API e dos pacotes continua no Node. O auxiliar `apps/web/src/__fixtures__/tela.tsx` dá a rede falsa, a
      sessão aberta e o cliente de consultas da aba; o primeiro caso é o de `ListaDePedidos.test.tsx` (estados, rótulo e
      o que cada papel vê, em 1 s). **Falta, por outra mão:** a linha "estados da tela" do modelo de tarefa
      (`.claude/skills/criar-tasks/`) passar a pedir teste de componente para a condição e e2e para o fluxo; e o `jsdom`
      não faz layout, então "texto cortado" e "celular espremido" continuam sendo da vitrine e do e2e. Da revisão da
      correção, **para quem pegar o resto**:
      - quando a linha "estados da tela" mudar, ela deve citar `apps/web/src/__fixtures__/tela.tsx`, para não nascer um
        segundo auxiliar, e conferir se o `jsdom` 30 já cobre o `showModal` do `DialogoDeDecisao` (hoje o diálogo fica
        no e2e);
      - a primeira tarefa que alterar a `ListaDePedidos` ou o `DialogoDeDecisao` leva os casos que a correção deixou:
        dois alunos com o mesmo nome (a marcação é por id), releitura que falha com a lista na tela ou lida e vazia, o
        limite de 40 marcados, "há mais pedidos" e o anúncio dos pedidos novos na região viva;
      - o `engines` da raiz (`>=22.18.0 <23`) fica abaixo do piso do `jsdom` 30.1.1 (`^22.22.2`): subir o piso para
        22.22.2 junto de quem tocar o `package.json` da raiz; esteira e `.nvmrc` (22.23.2) passam (dono: Joaquim)
- [ ] **(correção 2026-10-12-codigo-cru-no-nome-sintetico) Fechar a guarda do código cru de erro no e2e** (`revisor-geral`,
      `test-engineer` e `frontend-reviewer`, 1ª e 2ª rodadas; `tasks/correcoes/2026-10-12-codigo-cru-no-nome-sintetico.md`):
      `codigoCru` (`e2e/__fixtures__/verificacoes.ts`) trata como nome sintético qualquer `503` com vizinho hexadecimal, e
      por isso não vê o código cru colado a minúscula de `a` a `f` ou a dígito. Duas pontas soltas, na mesma mão:
      - **a trava contra a substring:** um teste de unidade ou regra de lint que reprove `not.toContainText('<três
        dígitos>')` em `e2e/`, com exceção de `guardas.spec.ts`, para o próximo spec não voltar a procurar o código como
        substring. Dentro dela: restringir o parâmetro de `codigoCru` a `` `${number}` `` ou validar `/^\d{3}$/` (hoje o
        `codigo` entra na `RegExp` sem escape), e a docstring citar os cinco códigos em uso (`404`, `409`, `429`, `500`,
        `503`) ou dizer "código HTTP de três dígitos";
      - **a expressão presa ao formato:** a exceção valer só para o código dentro de uma sequência de oito hexadecimais, e
        não para qualquer vizinho hexadecimal. Refaz as cinco mutações e o contrato do helper; só vale se aparecer um botão
        ou aviso em minúscula de `a` a `f` logo depois de um erro (gatilho do `/retro`).
- [x] **(D79) Imagens do compose de teste com nome fixo:** feito em 11/10/2026, sem tocar em `infra/`: fora do
      ambiente 0, `tools/ci/compose.ts` gera `.processo/compose-de-teste-N.yml`, que dá a cada imagem construída a
      etiqueta `teste-N`. Provado com um e2e no ambiente 1 (68 s, verde, sobre `educa-api:teste-1`)
- [ ] **(D79) Linhas: prova numa spec.** As tarefas autorizadas em paralelo correm em linhas
      (`tools/processo/linhas.ts`, `/seguir`, passos 3 e 6), com teto de três. Provado em repositório de teste: partida,
      encontro, conflito e conserto. Sem prova: os comandos do Maestri para o andar e o par de uma linha a mais, três
      e2e ao mesmo tempo nesta máquina, o consumo por hora do plano, e quanto tempo de spec as linhas tiram. Medir na
      retrospectiva da próxima spec (dono: Joaquim)
- [ ] **(F3, retro, M3) A pré-execução da vigia não enxerga o time, e a rotina voltou ao `/vigia`:** o
      `tools/processo/vigia.ts` (11/10/2026) foi ligado como `--pre-run` da rotina e acordou o Orquestrador em todo
      disparo. A rotina roda a pré-execução sem as variáveis `MAESTRI_*` do terminal (relato do Orquestrador,
      12/10/2026). Conferido no mesmo dia: sem `MAESTRI_SOCKET`, o `maestri list` responde "only available inside
      Maestri terminals"; `nomesDoTime` não acha terminal nenhum, e `decidir` devolve "nenhum terminal do time ligado"
      (`vigia.ts:39`), que imprime `/vigia`. Se o comando falhar, o `catch` da linha 64 imprime o mesmo. Nesse caminho,
      cada disparo ainda regrava `.processo/vigia.json` vazio (linha 63), e o relógio das duas horas se perde. A rotina
      voltou ao comando `/vigia`, sem `--pre-run`, que é a saída que o passo 9 do `/seguir` dá para a prova que falha;
      o passo 9 e `.claude/skills/vigia/SKILL.md` ainda descrevem a pré-execução. Falta: achar como a pré-execução
      recebe o ambiente de um terminal (o soquete e o id gravados em arquivo pelo Orquestrador, ou opção do
      `maestri routine`), provar com alguém trabalhando que a saída vazia não acorda o modelo, e só então religar e
      acertar os dois textos. Até lá, toda vigia acorda o Orquestrador: no F3, 96 de 100 foram "nada a fazer"
      (dono: Joaquim)
- [ ] **(F3, retro) 26 `@SemEscopo` em `resolucao-de-tenant.repository.ts`:** o `tenancy-guardian` apontou na 14.0
      que o número passa do sinal da regra 10, item 9. Declarar a exceção na regra ou partir o módulo é decisão de
      desenho sobre a regra 10, e não se resolve por retrospectiva: entra na Tech Spec da próxima spec que tocar sessão
      (dono: Joaquim)
- [ ] **(F3, retro) Recomendações de código e de teste que as tarefas deixaram "para o /retro":** a retrospectiva não
      altera código. A lista, com a tarefa de cada uma, está em `tasks/prd-lgpd-e-titular/retro.md`, "Pendências fora
      das propostas": sete reforços de teste (8.0, 9.0, 15.0, 18.0, 19.0, `e13311f`, `9d2887f`). Cada uma entra na
      próxima tarefa ou correção que abrir o arquivo. O lint que recusa `.skip` e `.only` entrou em 11/10/2026
      (guarda `teste-sem-desligar`) (dono: Joaquim)
- [ ] **Quando o F1 fechar: criar `release` e `develop`** (D23 revista). Ordem combinada: o
      branch de documentação entra no `main` quando o Joaquim avisar, depois `main` → `release`
      e `release` → `develop`. Atenção: o `docs/direcionamento-regulatorio` já conflita com a
      tarefa 17.0 em `docs/lgpd.md`, e o conflito precisa ser resolvido nesse merge
- [ ] **Ajustar o processo à D23 revista** (dono: Joaquim): a esteira do GitHub só roda no push
      do `main` (`.github/workflows`), e precisa rodar em `develop`, `release` e nos PRs; o hook
      de commit, o `/executar-task`, o `/corrigir` e a regra 40 ainda descrevem commit direto no
      `main` e esteira verde antes da tarefa seguinte; definir de qual branch sai o staging
- [x] ~~MVP de apresentação (D71): aceitar ou recusar os três afrouxamentos~~ — aceitos em
      23/09/2026 (D71 revista)
- [x] ~~**AIAs do MVP:** escrever a etapa 1 das AIAs de correção, diagnóstico, Tutor e sinais antes
      dos PRDs da A3, da A4 e da A5 (`docs/aia/`). A A1 e a A2 não têm função de alto risco além
      da adaptação, cuja etapa 1 entra antes do PRD da A2~~ — as cinco etapas 1 estão em `docs/aia/`
      (`d23179a`), fechadas para o MVP com as decisões do Joaquim de 05/10/2026 (`16183f4`); a A2 a A5
      não tiveram PRD (D77)
- [ ] **AIAs depois do MVP:** a revisão do Gabriel das cinco etapas 1 e as etapas 2 a 6 de cada uma,
      antes do primeiro aluno real (D60, D71; `docs/aia/README.md`)
- [x] ~~Ratificar ou recusar as D55 a D71~~ — ratificadas em bloco pelo Joaquim em 23/09/2026,
      com as revisões da D1, D17, D23, D32, D45 e D60
- [ ] **Avisar o Gabriel do que foi decidido em 23/09/2026:** a pele é uma só, a do ChatGPT, e
      Ferramentas e Turmas deixam a pele da Teachy (D72); três agentes (D32 revista); a A1 é a
      escola montada pela coordenação, sem seed (D71 revista); o material entra pela coordenação
      (D75). O mockup pode seguir com a pele da Teachy como estudo, mas o produto não

Pendências herdadas da validação do F0 (`tasks/prd-fundacao-tecnica/validacao.md`, seção 6
das rodadas 1 e 2). Os itens que valem para funcionalidade futura ficam lá e são lidos pelo
`/criar-techspec` dela.

- [x] ~~Conferência da esteira com `headSha` igual ao `origin/main` e só `success`~~ —
      passo 7 de `executar-task`, com regra para `cancelled`, execução não registrada e
      commit sem push (menor 1 da rodada 2)
- [x] ~~`npm ci` quando o lock é mais novo que o `node_modules`~~ — passo 4 de
      `executar-task` e portão do `validador` (menor 4 da rodada 2)
- [ ] Hook que recusa commit `(tarefa N.0)` quando a última execução da esteira no
      `origin/main` não for `success`, como o hook das revisões, com saída clara sem `gh`
      (menor 3 da rodada 2)
- [ ] `tasks/prd-fundacao-tecnica/prd.md:94`: trocar a borda para "a próxima tarefa não
      commita antes de a esteira do commit anterior ficar verde" (menor 2 da rodada 2)
- [ ] `docs/infra.md:211`: apontar a janela do lote não urgente para a Tech Spec do F0,
      seção 5, passo 2, com o padrão segunda a sexta, 7h às 18h, configurável por escola
      (menor 5 da rodada 2)
- [ ] Decidir os achados da auditoria da 16.0 fora do escopo: renovação da vaga durante o
      recuo, devolução do ponto no limitador, despachante serial (`16_task.md`)
- [ ] Descobrir por que o controle negativo do cenário de carga parou de reprovar. Em
      16/09/2026, em duas execuções seguidas, `npm run carga:controle-negativo` **não reprovou**:
      sem a vaga por escola, a espera da escola B ficou em 84 ms e 125 ms, contra o limiar de
      base + 500 ms. Em 14/09/2026 ele reprovava, com a B em p95 2,53 s contra 507 ms
      (`tasks/prd-fundacao-tecnica/15_task.md`, validação da 15.0). Não é a máquina ter ficado
      folgada por acaso: entre as duas medições entrou o commit `364049c`
      (`UV_THREADPOOL_SIZE=16` e `dns_opt` em api, realtime, despachante e worker), e na mesma
      comparação a espera dos interativos da própria A caiu de p95 10,3 s para 6,1 s — a vazão
      do worker subiu. A validação do F0 registra o mesmo na rodada dela
      (`tasks/prd-fundacao-tecnica/validacao.md`, RF18: controle negativo com `espera_b`
      p95 2,63 s), ou seja, são vinte vezes mais que agora. A pergunta a responder primeiro não
      é qual limiar mexer, e sim **por que a carga da escola A deixou de saturar o worker** — se
      ela não satura mais, o `npm run carga` verde também prova menos do que diz. Primeiro passo:
      repetir o cenário com o `UV_THREADPOOL_SIZE` de antes, para confirmar ou descartar essa
      causa; só depois decidir se o que muda é o cenário, o limiar ou a CPU de
      `infra/compose.carga.yml`. Enquanto isso, o controle negativo não está controlando nada.
      A regra 80, item 3, continua provada por `apps/despachante/test/vagas.int.test.ts`
      (controle negativo da vaga e "A sem vaga não atrasa B"), que roda no portão (dono: Joaquim)
- [x] ~~Teste intermitente da borda ("API não depende do resto")~~ — não era o teste: nome de
      serviço parado esgotava as 4 threads do libuv e a conexão ao Postgres esperava 15 s. Corrigido
      com `UV_THREADPOOL_SIZE=16` e resolvedor de 1 s (`docs/infra.md`, "Threads e DNS")
- [ ] Guarda de `npm audit` provada com fixture real de dependência vulnerável, e não só com
      o `npm` imitado (`tools/ci/scripts.test.ts:75`)
- [x] ~~`redis-fora.int.test.ts:97` com `start` sem `aguardarSaudavel`~~ — corrigido em 21/09/2026
      (`tasks/correcoes/2026-09-21-redis-fora-mede-a-subida-do-container.md`), e a guarda de lint
      `guardas/esperar-servico-do-compose` impede a próxima ocorrência da classe
- [ ] Medir uma vez a recuperação do despachante depois do `healthy` em `redis-fora.int.test.ts` e
      registrar o número, para o poll de 60 s passar a ser dimensionado em vez de herdado
      (`test-engineer`, três rodadas da correção de 21/09)
- [ ] **Esteira instável: tratar como desenho, não como três bugs soltos.** Em 20/09/2026, depois de
      nove execuções verdes seguidas, três testes **diferentes** falharam em três execuções, cada um
      passando na seguinte sem mudança nenhuma (reconciliação do despachante, e2e do `celular`,
      `infra/test/borda.int.test.ts` com 503 seguido de 400 em cascata), e um quarto vermelho
      intermitente aconteceu no portão local. Diagnóstico do `infra-guardian`: o job do e2e sobe o
      compose **inteiro** (~18 contêineres, incluindo `observabilidade`, sem limite de CPU em
      `infra/compose.yml`) no mesmo runner onde o Playwright roda com CPU ×4 e, no `celular`, 600 ms
      de RTT; `workers` não está fixado em `playwright.config.ts` e `retries: 0`. Nesse arranjo o
      orçamento de tempo não tem folga e contenção do runner vira vermelho que não reproduz na
      máquina. O que decidir: fixar `workers` na esteira, não subir `observabilidade` no job do e2e,
      e escolher entre folga de `expect` no perfil `celular` ou retentativa com o flake **registrado**
      (nunca mascarado). É tarefa, não correção — vale `/criar-tasks`. É o achado mais valioso da
      validação do F1. **Um dos vermelhos do `celular` já tem causa achada e corrigida**: o cliente
      Redis do login cortava em 100 ms e recusava o desafio no runner carregado
      (`tasks/correcoes/2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e.md`). Isso não
      fecha o item — a contenção do runner continua —, mas tira um caso da lista e mostra o padrão:
      prazo de produção medido num runner que não é produção
- [ ] **Intermitente com causa fechada, pronto para `/corrigir`: o "cookie alterado" de
      `apps/api/test/sessao-externa.int.test.ts:433` às vezes não altera nada.** A linha é
      `` `${valor.slice(0, -2)}${valor.endsWith('A') ? 'B' : 'A'}${valor.slice(-1)}` ``: a condição
      olha o **último** caractere e a troca escreve no **penúltimo**. Com o penúltimo já `A` e o
      último diferente de `A`, o cookie "alterado" sai idêntico ao original, o retorno é aceito e a
      asserção da linha 443 recebe `/` em vez de `/?falha=provedor`. Em base64url é ~1 em 64
      execuções. Visto em 22/09/2026 no portão local (o cookie do log terminava em `Aq`); passa 4 de
      4 isolado. O conserto é olhar o caractere que se troca — e vale conferir se a mesma inversão
      existe em outros "altera um caractere" da suíte
- [x] ~~`infra/test/borda.int.test.ts` — "handshake por polling": 503 seguido de 400 em cascata~~ —
      a causa não era ordem entre casos: o teste mandava 20 POSTs em paralelo no mesmo `sid`, e o
      engine.io recusa POST sobreposto
      (`tasks/correcoes/2026-09-23-borda-manda-polling-sobreposto.md`)
- [ ] Depois da correção `2026-09-23-porta-do-teste-na-faixa-efemera`: uma linha no cabeçalho de
      `infra/teste.env` e `infra/carga.env` dizendo que porta nova fica entre 23000 e 29999; o teste
      de ambiente conferir também o piso de 1024 e que teste e carga não repetem porta
      (`infra-guardian`); e, no `/retro`, reabrir a correção
      `2026-09-22-corrida-de-porta-na-observabilidade`, cujo 59100 também estava na faixa efêmera
      (`test-engineer`)
- [ ] Guarda de `video`/`screenshot` no mesmo laço de `tools/ci/esteira.test.ts` que já resolve
      `trace` e `outputDir` por projeto. Hoje os dois estão em `off` por padrão e não há furo, mas
      `video: 'on'` reabriria a evasão que a correção de 20/09 fechou, e a linha do runbook não cobre
      porque vídeo **é** saída do Playwright (`privacy-guardian`)
- [ ] **Primeira da fila** (`privacy-guardian`): guarda sobre `ARQUIVOS_AMBIENTE_TESTE` e a ausência
      de `process.env` em `tools/ci/compose.ts`. O runbook agora afirma **por escrito** que o artefato
      público do e2e é inofensivo porque o ambiente de teste sai só de `.env.example` e
      `infra/teste.env`, versionados. Afirmação de segurança em documento sem teste que a sustente é a
      mesma forma de furo que a correção de 20/09 fechou no `trace`
- [ ] `docs/lgpd.md` seção 4 — linha de furo conhecido: artefato de esteira em repositório público
      (traço do e2e, conteúdo sintético, 7 dias), para a próxima publicação de artefato encontrar a
      decisão escrita onde se procura (`privacy-guardian`)
- [ ] Logs dos serviços dentro de `test-results/` antes da publicação, para o artefato ter a ponta do
      servidor da linha de tempo (`infra-guardian`). **Atenção:** log de serviço não tem a garantia de
      sinteticidade que o traço do Playwright tem por construção, e o repositório é público — fazer
      isso muda a classe do que se publica e exige decidir de novo com o `privacy-guardian`
- [ ] **Defeito do hook de revisões:** `tools/processo/revisoes.ts:342` decide caducidade por
      `statSync(...).mtimeMs`, não por conteúdo. Revisor que faz teste de mutação (mutar e restaurar)
      move o `mtime` sem mudar uma linha, e **invalida a própria rodada ao fazer o trabalho que se
      espera dele** — custou duas rodadas na correção de 20/09. Comparar hash de conteúdo
      (`git hash-object`) encerra a classe
- [x] ~~**Defeito do hook de revisões:** rodada registrada na tabela do documento sem bloco de
      achado~~ — fechado na correção `2026-09-22-achado-de-revisao-nao-cabe-na-janela`. A causa era o
      regex que decidia guardar a rodada aprovada: exigia `Recomendações:` com dois pontos, e
      `## Recomendações (não bloqueiam)` seguido dos itens não casava. Agora quem decide é
      `exigenciaDaRodada`, que lê as sete formas que os revisores usam
- [x] ~~**Defeito do carimbo do portão local**, nas duas metades~~ — corrigido em 22/09/2026
      (`tasks/correcoes/2026-09-22-hook-do-commit-ignora-o-instantaneo-de-conteudo.md`): o instantâneo
      do portão passou a ser gravado com o conteúdo do **início** da corrida, e o portão recusa o
      carimbo se algo mudou enquanto ele rodava; e `avaliarPortao` passou a receber os instantâneos,
      com `documento` e `instantaneos` obrigatórios na assinatura, para esquecer o repasse não compilar
- [ ] **Duas sessões na mesma árvore não passam pelo portão.** O portão é de árvore inteira e o
      carimbo é um arquivo só (`.processo/portao.json`). Em 21/09, com duas sessões abertas: um
      portão saiu vermelho em 5 testes de integração que passavam sozinhos (disputa de container),
      e um `git reset --hard HEAD` de uma sessão apagou o trabalho não commitado da outra. Decidir o
      combinado — uma sessão por vez, ou worktree separada por sessão
- [x] ~~Guarda de lint para `start`/`up` sem `aguardarSaudavel`~~ — feita na retrospectiva do F1
      (`guardas/esperar-servico-do-compose`), com fixture e teste. Vale só em teste, deixa passar
      `up --wait`, e ao ser ligada apontou a última ocorrência aberta do repositório
- [ ] `aguardarSaudavel` depende do healthcheck de `interval: 2s` (`infra/compose.yml:44`), então o
      portão de saúde tende a chegar depois de o cliente já ter reconectado. Se algum teste precisar
      medir a latência de reconexão de fato, o ponto de partida honesto é o `ready` do cliente, não o
      healthcheck (`infra-guardian`, 20/09/2026)

Pendências de processo da retrospectiva da A1 (`tasks/prd-apresentacao-escola/retro.md`, "Decisão"). São mudanças em
código de `tools/processo/`, que pedem teste e revisão, por isso não entraram com o texto das skills.

- [ ] **Portão local sem o `dist` dos pacotes** (proposta 5 da retro da A1). A esteira começa do clone, sem
      `packages/*/dist`, e um dist velho na máquina deixou passar o vermelho da 17.0. O portão
      (`tools/processo/portao-local.ts`) remove `packages/*/dist` antes do `test` e de novo antes do `e2e` (um `ops:*`
      rodado pelo `test` reconstrói o dist), com o teste que roda o portão como processo
      (`tools/processo/revisoes.test.ts`): com um `packages/shared/dist` plantado, o e2e não o vê. Antes, verificar que
      o vitest e o typecheck não dependem do dist. Até lá, a guarda de `tools/ci/playwright.test.ts` (correção
      `e2e-sem-dist-do-shared`) fecha o caminho que causou o vermelho. Destino: correção própria
- [ ] **O hook cobra o `revisor-geral` na correção grande** (proposta 12 da retro da A1). O `/corrigir` já diz que ele é
      obrigatório com mais de 5 arquivos fora de `tasks/` ou com `.github/`, `tools/ci/` ou `tools/processo/`; falta o
      hook (`revisoresObrigatorios`, em `tools/processo/revisoes.ts`) exigir isso sem depender de a linha "Subagentes
      obrigatórios" do documento o listar. Destino: correção própria
- [ ] **Stashes antigos no `git stash`, para o Joaquim decidir** (dono: Joaquim). Continuam lá o "tarefa 1.0 A0
      aprovada, aguardando esteira", de 23/09, e o "resto do pop abortado do stash de 18/09". Conferir se o conteúdo já
      está em algum commit antes de qualquer `drop`. Ninguém descarta sem ele

Pendências de código da A0b que a retrospectiva deixou (`tasks/prd-apresentacao-painel/retro.md`, "Pendências de
código"), com o destino de cada uma. As pequenas foram fechadas na correção `2026-09-25-acabamento-da-a0b`.

- [ ] **Defeito, `/corrigir` próprio: o `desfazer` do contador de tentativas pode descontar do lugar errado**
      (`apps/api/src/credencial/contador-de-tentativas.ts`, `ContadorDeTentativas.desfazer`; `infra-guardian` da 4.0 da A0b).
      Ele desfaz no seguro em memória e, com o Redis `ready`, também no Redis, sem saber onde a tentativa foi contada. Se a
      reserva caiu no seguro (Redis fora naquela hora) e o Redis voltou antes do `desfazer`, o `SCRIPT_DESFAZER` tira do
      Redis uma falha que ele nunca contou, e libera uma falha real: é o lado que a regra do contador proíbe (errar só para
      o lado de segurar). O docblock hoje aceita o caso. Só acontece depois de senha ou código certos e com o Redis
      voltando no meio da tentativa. Correção: a `Reserva` liberada guarda onde foi contada (`redis` ou `seguro`), e o
      `desfazer` age só lá, com teste que reserva no seguro, liga o Redis com uma falha de antes e confere que ela continua
- [ ] Aceite do convite de operador e `renovar` em paralelo, e aceite e segundo fator em paralelo, sem teste de
      concorrência próprio; o rebaixamento do `convite/aceitar` com o Redis de cache fora só é provado pelo C36, com
      limitador falso (`test-engineer` da 9.0 da A0b). Destino: próxima tarefa que tocar
      `apps/api/src/operacao/convite/convite-operador.service.ts` ou `sessao.service.ts` da operação
- [ ] Página e `total` do painel em duas consultas paralelas, com fotografias diferentes do banco: uma escola criada entre
      as duas deixa o total fora da página (`apps/api/src/operacao/painel/painel.repository.ts`, `TOTAL_DE_ESCOLAS` e
      `escolasDaPagina`; 5.0 da A0b). Ler o total na própria consulta da página, com `count(*) over ()` antes do `limit`,
      também tira uma conexão. Destino: próxima tarefa que tocar `painel.repository.ts`
- [ ] `apps/web/src/operacao/paginas/Uso.tsx`: o `VazioDoUso` (`:114`) repete o `EstadoVazio`; e o número longo com
      `wrap-anywhere` (`:75`, `:101`) pode quebrar no meio entre 640 e ~760 px (`revisor-geral` e `frontend-reviewer` da
      8.0). Destino: próxima tarefa em `Uso.tsx` (a A2 deveria trazer o consumo de IA para esta tela e não trouxe: ver
      "Consumo de IA no painel da operação", no fim)
- [x] ~~`apps/web/src/rotas.tsx:53`: o `componentWillUnmount` da fronteira de erro não tem teste (`test-engineer` da
      10.0)~~ — feito na 11.0 da A1: a fronteira saiu para `apps/web/src/componentes/FronteiraDaArea.tsx`, o título da
      falha passou para o gancho `useTituloDaAba` da tela da falha, e o W5 de `e2e/areas.spec.ts` prova que sair dela pelo
      "Sair" devolve a aba ao título de antes
- [ ] `apps/web/src/operacao/paginas/Convite.tsx`: o `hashchange` não zera `aceitando`, e o botão do link novo fica
      desligado ("Salvando…") enquanto o aceite do link anterior está no ar, sem dizer por quê; o descarte do desafio só é
      seguro por isso, e a dependência precisa de um comentário junto ao `aoMudarOFragmento` (`revisor-geral` e
      `test-engineer` da 10.0). Destino: próxima tarefa em `Convite.tsx`
- [ ] `apps/api/test/arquitetura.test.ts`, `comandosDaMigration`: tira o comentário `--` antes do texto entre aspas, e um
      literal como `DEFAULT '--'` corta a linha e faz `tabelasSemEscola` ler errado o resto da migration. Hoje não existe
      esse caso (`revisor-geral` da 10.0). Destino: próxima tarefa que tocar esse teste, ou a primeira migration com `--`
      dentro de texto
- [ ] O anúncio atrasado "Escola X criada." (`role="status"` de `apps/web/src/operacao/paginas/Escolas.tsx:228`) fica fora
      do `<dialog>` modal reaberto, inerte para o leitor de tela: quem o usa pode não saber que o pedido cancelado criou a
      escola e repetir. No Nova rede nada segura o duplicado (`frontend-reviewer` da correção `7d495d0`). Destino: próxima
      tarefa que tocar `Escolas.tsx`
- [ ] `apps/api/src/operacao/painel/painel.service.ts:62` (`naEscola`): o mesmo caminho morto que a correção
      `2026-09-25-acabamento-da-a0b` tirou do segundo fator, `contextoAtual() ?? { requisicaoId: randomUUID() }`. Aqui a
      linha é escrita depois da gravação, então a falha fechada vai no começo do caso de uso, não no log. O mesmo vale para
      `refazerConviteDaCoordenacao` (`apps/api/src/sessao/convite/convite.service.ts`), que só o painel chama; no gerar e no
      revogar o fallback é vivo, porque os comandos `ops:*` rodam sem requisição (`tenancy-guardian` da correção). Destino:
      próxima tarefa que tocar `painel.service.ts` ou `convite.service.ts`
- [ ] Contador `banco.conexao_descartada{causa}`, separando erro de consulta e erro da conexão: hoje o descarte não
      aparece em métrica nenhuma, só a queda das conexões em uso, e o failover do Postgres gerenciado precisa ser sinal
      próprio (`infra-guardian` da correção `577d185`). Destino: antes do staging (D31)
- [ ] Professores com o mesmo nome na tela Professores da coordenação (A1, 14.0): a lista traz só usuário, nome e estado
      (sem e-mail, para não dizer se a conta do e-mail existia, E11), e duas pessoas de mesmo nome dão duas linhas e dois
      "Refazer o convite de …" iguais; o link refeito de uma pode ir para a outra. A tela avisa o nome repetido no resumo
      do cadastro, sem impedir. O desempate de verdade é o e-mail na linha, que muda o contrato da 3.0
      (`esquemaProfessorDaEscola`) e o E11 (`test-engineer` e `frontend-reviewer` da 14.0). A consequência, pela matriz
      de estados (leitura do `privacy-guardian`, não reproduzida): quem recebe o link errado define a senha da conta da
      outra pessoa; a linha vira `aceito`, que não tem refazer nem revogar, e recadastrar o e-mail dá `CONFLITO`; a pessoa
      certa fica sem caminho até o reset de senha (F2). É o mesmo risco da conta global da Tech Spec da A1, seção 13,
      tolerado enquanto o dado for sintético. Posição do `privacy-guardian` para a decisão: o e-mail na linha é aceitável
      (está na tabela de dados, e foi a coordenação que o digitou), com três condições — só nas linhas com convite em
      aberto (`pendente`, `vencido`); decidir se a origem é o e-mail global da conta ou o que a escola digitou (campo
      novo, com linha própria no `docs/lgpd.md`); e o E11 passar a provar que o e-mail aparece igual nos dois casos.
      Destino: junto da prova de posse do e-mail do "Portão da primeira escola real" (`ROADMAP.md`)
- [ ] A trava do pedido no ar e o alerta com foco existem duas vezes na web: `useEnvioUnico` e `AlertaDaFalha`, em
      `apps/web/src/componentes/dialogos.tsx` (A1, 13.0; vieram para `componentes/` na 15.0, e o `useEnvioUnico` passou a
      receber as opções da mutação, com que o acesso da turma já o usa), e o `noAr` de
      `apps/web/src/componentes/DialogoDoConvite.tsx` com o `Falha` de `componentes/copia-unica.tsx` (da A0b). O diálogo
      do convite passar a usar o `useEnvioUnico`, e o `Falha` e o `AlertaDaFalha` virarem um só, deixa um jeito só
      (`revisor-geral` da 14.0).
      Não é troca de nome: o `Falha` leva o foco de novo a cada erro, e o `AlertaDaFalha`, só quando o texto muda, e a
      trava do diálogo está sob o e2e da A0b e as mutações da 14.0. Na mesma correção: o mapa
      `TEXTOS_DO_CONVITE_QUE_MUDOU` de `areas/coordenacao/professores/convite-de-professor.ts` difere por uma letra do texto
      `TEXTO_DO_CONVITE_QUE_MUDOU` que o arquivo importa; dar ao mapa um nome que diga o que ele é (`revisor-geral` da
      14.0, 2ª rodada). E `linkDoConvite` e `copiarLink` (`componentes/link-do-convite.ts`) já montam também o link da
      sala e copiam o convite inteiro do WhatsApp: `linkComToken` e `copiarTexto`, ou equivalente (`revisor-geral` da
      15.0); e `codigoEmDoisGrupos` (`areas/professor/turmas/acesso/acesso-da-turma.ts`) é só outro nome de `exibirCodigoDaTurma`. Destino: correção própria
- [ ] Acesso da turma (A1, 15.0): o gerar espera a releitura da seção antes de mostrar o link e o código
      (`apps/web/src/areas/professor/turmas/api/acesso.ts`, `onSettled`). Numa rede que engasga, o diálogo fica em "Gerando…" com o acesso já
      gerado no servidor. O `frontend-reviewer` sugere mostrar o acesso assim que o `POST` responde e recarregar a seção
      por trás; pede resolver junto o foco de quem fecha antes da releitura (o "Gerar acesso" do vazio some) e a seção
      que afirma "Sem acesso ativo" nesse intervalo. Decidido no `/validar` da A1 (04/10/2026): não segura a A1, porque o
      acesso já fica gerado no servidor e a demonstração usa dado sintético. Destino: correção de acabamento antes da
      primeira demonstração externa
- [ ] Testes do fim do vínculo (N2 e N3 da validação da A1, rodada 2): em `apps/api/test/acesso-fim-do-vinculo.int.test.ts`,
      falta o caso do professor com vínculo em duas escolas, em que a eliminação na escola A não pode revogar o acesso que
      ele gerou na B, pelo caminho da eliminação (`tenancy-guardian`); e o teste da trava do vínculo pendente termina em
      `await eliminando` sem conferir que o vínculo saiu e que não ficou acesso vigente (`test-engineer`). Destino: a
      próxima tarefa que tocar o arquivo, ou o F2
- [x] Encerrar o vínculo do professor não revoga o acesso da turma que ele gerou (A1, 4.0; achado do `privacy-guardian`
      na 15.0; G1 da validação da A1). Resolvido pela correção `2026-10-03-acesso-sobrevive-ao-vinculo`
      (`tasks/correcoes/2026-10-03-acesso-sobrevive-ao-vinculo.md`): o fim do último vínculo confirmado dele na turma
      (encerrar ou eliminação) revoga, na mesma transação e com auditoria, o acesso vigente que ele gerou
- [ ] A desativação do professor (`CicloDeVidaService.desativar`, 17.0) não encerra os vínculos dele nem revoga o acesso
      da turma que ele gerou: ele deixa de entrar, mas o link e o código que já tem continuam abrindo a sala até vencerem.
      Fechar junto com a tela de estrutura do F2 (que chama a desativação): ou a desativação encerra os vínculos pelo
      mesmo caminho do encerrar (e a revogação vem junto), ou revoga o acesso dele com a mesma trava da turma. Ficou fora
      da correção `2026-10-03-acesso-sobrevive-ao-vinculo`, que cobre o fim do vínculo. Junto, a janela que o
      `infra-guardian` registrou na eliminação: a coordenação cria um vínculo novo do mesmo professor numa turma ainda não
      travada, e ele confirma e gera antes do `delete` dos vínculos (improvável; fecha quando a trava passar a ser no
      usuário). E o `40P01` que ainda sai `ERRO_INTERNO` (`mapear-erro-postgres.ts`): `CONFLITO` ou uma nova tentativa,
      numa correção geral. Destino: F2, antes do portão da primeira escola real
- [ ] `Referrer-Policy` na borda (`no-referrer` ou `same-origin`): a aba do `wa.me` que o botão do WhatsApp abre recebe
      a origem da web como referência (`privacy-guardian` da 15.0). Não é dado pessoal; fecha com os cabeçalhos de
      segurança da borda, com o `infra-guardian`
- [ ] O formato do token opaco de 43 caracteres base64url está em dois lugares: `esquemaTokenDeLink`
      (`packages/shared/src/sessao/token.ts`: convite da coordenação, link da sala e, desde a 14.0 da A1, o convite de
      professor) e o `FORMATO_DO_REFRESH` (`apps/api/src/sessao/renovacao/renovacao.service.ts` e
      `apps/api/src/operacao/sessao/sessao.service.ts`). Unificar os dois da API no mesmo formato (`revisor-geral` da 4.0 da A1).
      A 14.0 fez a parte do convite de professor; o refresh é da API de sessão, fora de uma tarefa de tela. Destino:
      correção própria
- [ ] **(X1, retrospectiva) Código de processo que a X1 pediu** (`tasks/prd-pele-e-casca/retro.md`, M1 a M3). Correção
      própria, com teste e revisão; mexe em `tools/processo/` e `tools/ci/`:
      (a) **o portão da tarefa mede a duração do e2e que roda** (**feito** em 18/10/2026 na correção `2026-10-18-duracao-do-e2e-no-portao`,
      `tools/ci/duracao-do-e2e.ts`: repórter `json` ligado pelo portão, caso alterado pelo diff do git; o portão completo não mede; **limites conhecidos**: o caso vai do `test(` até a linha antes do `test(` seguinte, então um `beforeEach` ou ajudante entre dois `describe` é cobrado do último caso de cima e os de baixo passam sem cobrança, e o que fica fora de todo caso (importação, ajudante ou `beforeEach` acima do primeiro caso, `e2e/__fixtures__/`) que ficar mais lento não é cobrado de caso nenhum; caso pulado some das fronteiras, e `.skip` é proibido pela regra 40; **a rever** se aparecer na esteira caso lento por esses caminhos: tratar mudança fora de qualquer caso como mudança no arquivo inteiro, o que muda o contrato do portão; **a rever na correção `2026-10-18-duracao-do-e2e-le-o-prazo-declarado`**, que fez a régua ler o prazo declarado no HEAD: (1) `INICIO_DE_CASO` casa com o `.test('literal')` de um `RegExp`, e um `(?<![.\w])` antes de `test` fecharia, com teste e bloco próprios (hoje só aperta a régua); (2) `semComentarios` é um leitor feito à mão que não entende expressão regular literal, e trocá-lo pelo `ts.createScanner`, como `impressaoSemComentarios` em `tools/processo/revisoes.ts`, acabaria com o limite e com a lista de termos a provar): caso alterado que passa de 15 s na máquina fica vermelho,
      porque o runner leva perto do dobro e o prazo é 30 s. Na X1, os casos que caíram na esteira levavam de 19 a 29 s aqui,
      e custaram duas correções e duas rodadas de validação depois da validação aprovada;
      (b) **o hook conta as rodadas pelo `achados/`**, e não pelas linhas da seção "Revisões" (`tools/processo/revisoes.ts`,
      `acrescentarRevisao`): a seção sumiu duas vezes na X1 e a contagem recomeçou do 1
      (**feito** em 18/10/2026 na correção `2026-10-18-rodada-conta-pelos-achados`: a rodada é o maior entre as linhas da tabela
      e a maior rodada do revisor em `achados/<documento>.md` (`ultimaRodadaNosAchados`), mais um; **limite**: o arquivo de achados só
      guarda a rodada que exigiu algo, então a seção que some depois de uma aprovação limpa ainda perde essa rodada, o que `revisoes.test.ts` fixa num `it`; **a rever**: (i) a contagem
      de reprovações seguidas da Mesa (`.claude/skills/revisar-tarefa/SKILL.md`, passo 4) ainda sai das linhas da tabela, e com a seção apagada ela vê uma
      linha só e não escala quando devia: contar também pelos cabeçalhos de `achados/<documento>.md` muda o comportamento da skill; (ii) o regex de
      `ultimaRodadaNosAchados` lê cabeçalho com data em qualquer ponto do arquivo, então um cabeçalho completo colado no texto do revisor, de outra
      tarefa ou de rodada futura, faz a contagem pular números; ancorá-lo no fim da linha muda o regex; (iii) `acrescentarRevisao(..., undefined, achadosAnteriores)`
      recebe a nota e os achados por posição: um objeto de opções na próxima tarefa que tocar a função);
      (c) `tools/ci/e2e.ts` repassa `--repeat-each` e `--workers` ao Playwright (eram descartados sem aviso e o arquivo rodava uma vez;
      **feito** em 18/10/2026 na correção `2026-10-18-e2e-repassa-repeat-each-e-workers`: `opcoesDoPlaywright` passa as duas, sempre com `=`);
      `tools/processo/linhas.ts conferir` aceita a correção feita na branch da spec (**feito** em 18/10/2026 na correção `2026-10-18-conferir-aceita-correcao-na-spec`: na branch `spec/…` vale a marca `(tarefa N.0)` de qualquer tarefa, com `Revisões:`, e o último commit com código tem de ser o da correção; o merge do encontro só é cobrado pelo que resolveu à mão; **a rever**: a correção só de documento feita na spec, depois do último commit de tarefa, é recusada pelo `conferir`, e na correção avulsa passa; aceitá-la muda o comportamento do comando; **a rever também**: o "último commit com código" do `conferir` na spec vem da ordem do `rev-list --reverse`, que segue a data do commit, e o `conferir` rodado depois de um encontro que veio depois da correção poderia ver o commit de tarefa da linha por último e recusar sem razão; **a rever também** (3ª rodada da correção `2026-10-18-conferir-aceita-correcao-na-spec`): (i) `--remerge-diff` pede git 2.36 ou mais novo (a máquina tem 2.56, a esteira 2.43 ou mais); num git antigo o `git()` lança e o `conferir` cai com stack trace, e vale uma frase no comentário de `arquivosDoCommit` ou uma checagem de versão; (ii) conflito que não é de conteúdo (apagado de um lado e alterado do outro, renomeado) pode fazer o `--remerge-diff --name-only` imprimir linha "remerge CONFLICT" que não é caminho e seria lida como código: verificar com caso real e, se for o caso, filtrar só o que é caminho; (iii) falta um `it` do merge que acrescenta código novo sem conflito (cobrado, o que está certo), a montar junto de (ii); (iv) a frase do documento da correção sobre o `it` de "trechos diferentes" cita o diff contra o primeiro pai, cuja mutação está no `it` de duas linhas com `a.ts` e `b.ts`);
      e `tools/processo/mutacoes.ts` roda o caso de e2e no projeto que ele declara, e não sempre no `chromebook`, para a
      cláusula que só vale no celular se provar (**feito** em 18/10/2026 na correção `2026-10-18-mutacao-de-e2e-no-projeto-declarado`:
      o bloco `mutacao` ganha a linha opcional `projeto: celular|chromebook`, só para teste de e2e, e sem ela o projeto é o
      `chromebook`; a corrida limpa e a mutada são por projeto; **limite**: a lista de projetos é `PROJETOS_DO_E2E`, em
      `mutacoes.ts`, conferida contra o `playwright.config.ts` por um teste, e projeto novo nele pede a linha ali; **a rever**: o parser de `lerMutacoes` aceita duas linhas `projeto:`, `arquivo:` ou `teste:` no mesmo bloco e vale a última, sem aviso; "linha repetida" seria erro do bloco nos três campos, o que muda o comportamento do parser).
      **Ficou sem fazer, e a X2 pagou de novo** (`tasks/prd-telas-da-coordenacao/retro.md`): sete correções de e2e acima dos
      30 s na esteira, quatro delas de casos que já passavam de 15 s na máquina (`material:180`, `areas:316`, `agentes:164`
      e `:186`), e 33 min perdidos na 2.0 com o `e2e.ts` rodando a suíte inteira. **Destino que o Joaquim deu em 18/10/2026:
      antes da primeira tarefa da X3**, numa correção só, junto com o que a X2 acrescentou:
      (d) **o portão roda também os e2e que citam um texto que o diff tirou de `apps/web/src`** (um literal removido que
      aparece em `e2e/`): o W12 da casca (a 3.0 trocou "Governança", `casca.spec.ts:673`, vermelho em cinco execuções da
      esteira) e o sino da 6.0 ("Refazer o convite de", `sino-da-coordenacao.spec.ts:86`) quebraram fora do diff
      (**feito** em 18/10/2026 na correção `2026-10-18-e2e-que-cita-literal-removido`, `tools/ci/e2e-que-cita-literal.ts`: do
      `git diff -U0 HEAD -- apps/web/src` saem os literais removidos que o diff não recolocou, e o `e2e/*.spec.ts` que cita algum,
      sem diferenciar maiúscula, entra nos alvos do portão da tarefa; **limites conhecidos**: o spec que cita só um pedaço do texto removido não entra (tirar "Governança da escola" não puxa
      `/governança/i`); o texto de JSX que continua em linha de baixo começando em minúscula, e o template que atravessa linhas, não
      viram literal; e o literal citado só num ajudante de `e2e/__fixtures__/` não puxa os specs que o importam. O limite "o literal curto e comum
      ("Professor", "Estrutura") puxa todo spec que o cita" (24 dos 59 specs num diff de 40 commits, `3be23c9`) **foi corrigido** em
      19/10/2026 na correção `2026-10-19-detector-de-literal-compara-com-a-web`: o literal só conta como tirado quando nenhum
      `apps/web/src/**/*.{ts,tsx}` (menos o `.test`) ainda o tem, e não mais quando sai de um arquivo; o preço é que o spec que o procura
      justamente na tela trocada, com outro arquivo da web ainda o tendo, só cai na esteira. **Correção seguinte desta letra** (recomendações sem aplicar da `2026-10-18-e2e-que-cita-literal-removido`): (1) descartar o
      literal que vem de `className=`/`class=` (classe do Tailwind, "sr-only", conta como texto de tela e no `290b7cb` puxou quatro specs
      sem relação); (2) teste da linha de log `▶ <spec> entra nos alvos: cita "<texto>"` do portão, que roda o portão; (3) excluir
      `apps/web/src/__fixtures__/` como o `.test.tsx`, e também `apps/web/src/galeria/` (repete rótulos reais das telas: "Tentar de novo", "Esperando você", "Turmas") e os dois `__fixtures__/` (`literaisDaWeb` hoje os lê; muda o que o detector aceita e pede teste e mutação próprios); (4) o comentário de cabeçalho de `tools/ci/e2e-que-cita-literal.ts` ainda diz "o que só custa minutos" e cita só os limites antigos (copiar os quatro de `executar-task`); e talvez um aviso do portão quando o número de specs puxados passar de um teto);
      (e) **a vitrine lista as telas cuja página rola a 1366 × 768** (a altura medida em `tools/vitrine/foto.ts` passa da
      janela), no relatório que a Mesa e o Validador leem: na X2 o "só o miolo rola" (RF23) só foi visto pela altura das
      fotos, contada à mão, e escapou em duas telas até a validação (C1, C2)
      (**feito** em 18/10/2026 na correção `2026-10-18-vitrine-lista-telas-que-rolam`: o `foto` termina com `relatorioDeRolagem`,
      uma linha por tela do computador cuja altura medida passa de 768 px, ou "Nenhuma tela rola a 1366 × 768", e a Mesa a repassa
      aos revisores na linha `Rolam a 1366 × 768`; **limites**: só diz que rola, não se rola por desenho (tabela comprida) ou por
      defeito, e quem decide é quem lê o PRD; a altura é a da página inteira (`scrollHeight`), então um miolo com `overflow` próprio
      cabe na janela e não aparece; só o computador, no celular toda tela rola; a ligação do `vitrine.ts` ao relatório não tem teste
      sem a web de pé, só `linhasDoResultado` tem; a `medida` que `fotografar` monta (`alturaDaPagina: altura`) e passa a `fotosDaTela` também só se prova com a web de pé: `fotosDaTela` e o relatório têm teste, a troca de `altura` por outro número ali não; a página redirecionada (`parouEm` diferente de `caminho`) entra no relatório com o endereço pedido e a altura da página onde parou, e as linhas de arquivo avisam do redirecionamento; no `catch` de `fotografar` a altura é a medida antes da foto, e se a página cresceu depois ela fica velha);
      (f) **o `flock /tmp/educa-carga.lock` dentro do `portao-local.ts` e do `tools/ci/e2e.ts`**, para a fila de carga entre
      as linhas não depender de quem digita o comando (o texto do `executar-task` e do `/seguir` vale até lá).
      **Feita** na correção `2026-10-18-fila-de-carga-no-codigo` (`tools/ci/fila-de-carga.ts`); seguem abertas a (b), a (g) e a última frase da (c) (o projeto da mutação de e2e; o `linhas.ts conferir` foi feito na correção `2026-10-18-conferir-aceita-correcao-na-spec`); a primeira frase da (c) foi feita na correção acima, e a (a), na `2026-10-18-duracao-do-e2e-no-portao`. Limites conhecidos da (f): o aviso de espera não diz quem segura a fila (o pid já sai de
      `donosDoTravamento`), e matar o comando de fora com `kill -9` deixa o relançado segurando a vez até acabar; e a pasta `fila-` que `tools/processo/revisoes.test.ts` cria em `/tmp` a cada execução nunca é apagada (apagar junto com a `raiz` na próxima correção que tocar esse teste)
      (g) **o `tools/ci/e2e.ts` recusa, ou ao menos avisa, a opção que descarta**: opção com `-` fora da lista de
      `opcoesDoPlaywright` (`--headed`) some sem aviso, e o valor solto (`--workers 1`, `--repeat-each 10`, `--grep nome`) é lido como
      arquivo. Recusar com erro, como `fatiaDosArgumentos` faz com `--shard`, ou no mínimo uma linha no log com o que foi descartado.
      Destino: a próxima correção que tocar `opcoesDoPlaywright` (recomendação dos três revisores da correção
      `2026-10-18-e2e-repassa-repeat-each-e-workers`)
- [ ] **A vitrine não fotografa troca do Tutor do aluno** (validação da X1, rodada 1): ela não digita, e a escola
      sintética não tem troca do Tutor, então o balão com a assinatura não sai em foto. Destino: antes da X4, que mexe
      na tela do Tutor do aluno

## Regulação educacional

- [ ] Acompanhar a homologação pelo MEC e a publicação das diretrizes do CNE; ler o texto
      oficial e revisar a regra 70, principalmente correção de discursiva e redação (D46, D55)
      e a classificação dos sinais do tutor. **É o que decide se a devolutiva formativa de
      discursiva volta a existir no produto**
- [ ] Acompanhar a **regulamentação da ANPD sobre o art. 11 do Decreto 12.880/2026** (IA
      conversacional com criança e adolescente): pode trazer requisito técnico novo para o
      Tutor (D58, D59)
- [ ] Ler e destrinchar em requisito: **Guia de Classificação Indicativa do MJ (out/2025),
      capítulo Interatividade** — o MEC manda o desenvolvedor segui-lo; **Resolução CNE/CEB
      2/2025** (Educação Digital e Midiática); **Children & AI Design Code** (5Rights, 2025)
- [ ] Verificar se Santa Catarina tem lei estadual sobre aparelhos na escola além da Lei
      15.100
- [ ] Transformar a conformidade em material de venda: "já estamos dentro do prazo de 12 meses"
- [ ] Confirmar exigências de registro escolar da rede alvo

## Material didático

- [x] ~~**O documento que a coordenação sobe na demonstração** (D75): nosso ou de domínio
      público, com a licença declarada, de uma disciplina que renda boa demonstração. Não é
      material pré-carregado: não há seed de escola nem de material (D71 revista). Antes do PRD
      da A2 (D5)~~ — feito no MVP: "Química 2, cap. 7 — Estequiometria", texto original da equipe
      Turmma, em `tools/demonstracao/quimica-2-cap-7-estequiometria.pdf`, gerado por
      `tools/demonstracao/gerar-material.ts`; a licença declarada na tela está no passo 1 de
      `docs/roteiro-da-demonstracao.md`

- [ ] Modelo de autorização escrita da escola para cada fonte de material
- [ ] Parecer sobre direito autoral da ingestão (Lei 9.610, art. 29, IX; termos de Arco/SAS,
      Positivo, Bernoulli e Somos), incluindo apostila impressa escaneada (D5 revista)
- [ ] Buscar parceria ou licença com editora ou sistema de ensino para uso do material na
      base da escola
- [ ] Levantar quais sistemas de ensino as escolas alvo usam e se elas têm material próprio
      ou PDF licenciado (decide o primeiro material do piloto e o primeiro adaptador, D22)
- [x] ~~Decidir: adaptador por fonte ou extração genérica~~ — upload primeiro, adaptador por
      fonte quando houver escola real (D22)
- [ ] Conjunto fixo de amostras para medir qualidade da extração e da classificação BNCC
- [ ] Baixar e organizar as provas oficiais do ENEM do INEP para o banco público (D21)
- [ ] Verificar licença de uso das provas de vestibular antes de incluir qualquer uma

## Produto

- [x] ~~Fechar o que da revisão dos mockups trava o PRD da A1~~ — em 23/09/2026: um agente por
      pessoa (D32, D9 e D60 revistas), a pele e o padrão de espaço (D72), a navegação do professor
      (D73). Continuam em `docs/pendencias-dos-mockups.md` os que pedem `/descobrir` antes de
      qualquer PRD: **projetos**, **anexo na conversa** (abre a porta para correção de discursiva
      por IA: D55) e **faltas** (não existe no roadmap nem na tabela da LGPD)
- [ ] **Catálogo de ferramentas (P22 a P25).** A regra e as quatro categorias estão na D74. Falta
      passar por `/descobrir` as oito ferramentas que a D67 não lista (planejamento do período,
      projeto, plano de recuperação, mapa mental, roteiro de experimento, avaliação diagnóstica,
      proposta de redação, importar prova), uma a uma, antes de entrarem no F7. A ferramenta como
      dado (P23) entrou no MVP: um motor de formulário só, em
      `apps/web/src/componentes/ui/ia/motor-formulario.ts` e `MotorFormulario.tsx`
- [ ] **Sétima e oitava rodadas dos mockups (P26 a P31).** A pele ficou uma só (D72), e como a do
      produto não copia a Teachy, a consulta ao advogado sobre cópia fiel (P31) só volta se alguém
      propuser copiar de novo. O seletor de escola que troca o token (P30) e o convite por link,
      WhatsApp e código (P27) entraram na A1. Antes do PRD do F6: as abas da turma aberta além de
      Visão Geral e Alunos, as duas que o MVP entregou (P28). Por `/descobrir`: **ranking de participação**
      (P26, bate na 10.2 do `docs/interface.md` e na D57), **Recursos** e **Mural** (P28)
- [x] A1 (antes era o F2): o vínculo de aluno criado pela lista de nomes precisa nascer com `decidido_em` preenchido. A lista de alunos do ano encerrado (10.0) só traz quem chegou confirmado ao fim do ano, e hoje só a fixture de teste grava esse campo: sem ele, o aluno some do histórico da turma — feito na tarefa 8.0 da A1 (`VinculoRepository.criarAlunoConfirmado`, E19)

- [x] ~~Fechar a lista de agentes e o nível de autonomia de cada um~~ — D32 a D36; lista
      revista em 19/09/2026 para seis agentes e em 23/09/2026 para três, um por pessoa da escola,
      com a autonomia por função (D32, D9)
- [ ] Validar com advogado a base legal para guardar a adaptação necessária do aluno (D35),
      agora lida também pelo Tutor para ajustar a forma da conversa (D66)
- [ ] **Lista padrão de fontes aprovadas** da busca do Tutor, por faixa etária (anos finais e
      Ensino Médio), com critério escrito de entrada e de saída; e escolher o provedor de busca,
      que entra como suboperador (D68). Antes do PRD do F9
- [ ] Decidir de onde vêm as imagens da ferramenta de apresentação, e com que licença (D67, D5).
      Antes do PRD do F7
- [ ] Fechar os indicadores de turma e aluno de Turmas **antes do PRD do F6** (D69, D73), junto
      com os limiares provisórios que o MVP mostra (sinais do Tutor, destaques da correção, 60% do
      alerta do Analista; Estado de `docs/mvp-rapido.md`).
      Ponto de partida: percentual de erro e acerto por habilidade, e "concluiu o que foi
      atribuído". Tempo ocioso e navegação não entram
- [ ] **Guia para a TI da escola** bloquear outras IAs no computador do aluno (Google Admin,
      filtro da rede). É a resposta ao pedido de "avisar quando o aluno usa outra IA", que o
      produto não faz (D70). Entra no dossiê (D61)
- [ ] Texto da mensagem fixa de acolhimento do tutor, revisado por uma orientadora
      educacional de verdade (D36)
- [ ] **O encaminhamento do assunto delicado (D36) gasta uma das 60 trocas do dia (D38)?** Em 12/10/2026 o Joaquim
      ficou com **"gasta, por ora"**; a resposta definitiva segue aberta. O que o código faz (`develop` em `bbae49e`,
      verificação do Arquiteto):
      - **com o freio esgotado, o texto que casa com os gatilhos é encaminhado e recebe o 188:**
        `apps/api/src/tutor/tutor.service.ts:164` vem antes do orçamento (175-176), e o `#encaminhar` (318) não
        consulta o freio. Provado em `apps/api/src/tutor/tutor.int.test.ts:322` e, na tela, em
        `e2e/aluno-tutor.spec.ts:316` (API simulada)
      - **o que os gatilhos não pegam, no limite, não chega ao modelo** (`tutor.service.ts:175-176`): o aluno vê
        "Por hoje acabou", sem o 188, sem a indicação de um adulto e sem sinal ao professor
        (`apps/web/src/areas/aluno/tutor.ts:65-70`). Vale igual com avaliação aberta, pacote esgotado e função
        suspensa. Decidir junto se o aviso de pausa ganha uma linha fixa apontando para um adulto e para o 188
      - **o encaminhamento conta:** a pergunta entra com `autor = 'aluno'` e a execução `concluida`
        (`tutor.service.ts:335-340`), e as quatro contas leem essa linha sem olhar o tipo do turno: o freio e o
        pacote do mês (`apps/api/src/ia/orcamento.repository.ts:63`), o "Hoje: N de 60" do aluno
        (`apps/api/src/tutor/tutor.repository.ts:390`) e as duas do professor
        (`apps/api/src/tutor/supervisao.repository.ts:278` e `:298`). Na 59ª troca, o encaminhamento ocupa a 60ª; no
        limite, a conta passa de 60 e a tela a prende em "60 de 60"; cada um tira uma troca do pacote da turma
      - **contar não limita nada:** o encaminhamento passa na frente do freio e custa zero token; o laço segue sem
        teto próprio (item "Assunto delicado sem teto de IA", abaixo)
      - **a conta está fixada em teste desde 12/10/2026** (correção `2026-10-12-encaminhamento-gasta-troca`,
        `c6e8511`): o grupo "o encaminhamento gasta uma troca, por ora" de `apps/api/src/tutor/tutor.int.test.ts`
        (1 depois do encaminhamento; na 59ª troca ele ocupa a 60ª; no limite, 61 de 60, com o estado `limite`), e
        `e2e/aluno-fluxo.spec.ts` passou a esperar `Hoje: 1 de 60 perguntas`, sem a corrida com a releitura da
        conversa. Se a resposta virar "não gasta", esses casos mudam junto
      - **o que os revisores da correção deixaram** (tabela "Recomendações sem aplicar" de
        `tasks/correcoes/2026-10-12-encaminhamento-gasta-troca.md`): o 61 de 60 confirma o laço sem teto do item
        "Assunto delicado sem teto de IA"; o aluno que relata algo pessoal na 59ª troca perde a última dúvida comum
        do dia, que pesa para "não gasta"; falta um caso que afirme a conta no pacote do mês (`porMes`), para a
        primeira tarefa que alterar o arquivo com o pacote; e falta um caso com duas chamadas em paralelo e a mesma
        chave no encaminhamento, provando que a troca conta uma vez só (pode achar defeito de produção, que seria
        `/corrigir` próprio)
      - **se a resposta virar "não gasta":** as quatro consultas mudam juntas, pelo `tipo` da resposta do turno, como
        `turnosParaATarefa` já filtra (`tutor.repository.ts:349`); é código do Tutor (`infra-guardian` e
        `conformidade-reviewer`) e muda o número que o professor vê (D8)
      (dono: Joaquim)
- [ ] O que a coluna Uso da tela Escolas da operação mostra no vínculo do ano novo antes de a turma ser importada: hoje, com
      `turmas: 0`, ela diz "Sem turma ainda" e esconde a contagem de professores (e a de alunos), mesmo que haja professor com
      vínculo. Decidir o texto (só "Sem turma ainda", ou a contagem que existir) e declarar a intenção num teste
      (`test-engineer` na 14.0 da X2) (dono: Joaquim e Gabriel)
- [ ] **A descrição de cada ferramenta e o "Como vai sair" repetem quase o mesmo** (atividade objetiva, plano de aula e
      Adaptação): a frase de apoio abaixo do título do formulário e a primeira linha do texto fixo ao lado dizem a mesma
      coisa. Diferenciar quando o F7 acrescentar ferramentas e o catálogo voltar à mesa
      (`frontend-reviewer` na 8.0 da telas-do-professor; `COMO_VAI_SAIR`, em `apps/web/src/areas/professor/ferramentas/ferramentas.ts`)
      (dono: Joaquim e Gabriel)
- [ ] **A atividade objetiva vai ao aluno por "Aplicar à turma", sem entrega com rejeição e justificativa** (regra 70, item 3).
      Decidir antes do piloto se "não aplicar" conta como a rejeição que a regra pede, ou se a atividade ganha uma entrega
      pendente como a versão adaptada. Já existia antes da 8.0, que só passou a dizer isso na tela
      (`conformidade-reviewer` na 8.0 da telas-do-professor; `AplicacaoDoArtefato.tsx`) (dono: Joaquim)
- [x] ~~Definir teto de uso do tutor por aluno e orçamento de tokens~~ — D38, D39, D41
- [x] ~~Decidir o modelo de cobrança~~ — por aluno, uso incluso, sem crédito (D40)
- [x] ~~Decidir se o aluno acessa de casa desde o início~~ — escola decide por turma (D19)
- [x] ~~Definir o que o coordenador precisa ver na primeira semana~~ — as quatro coisas do D24

## Marca e interface

- [ ] **A seção 1.4 de `docs/interface.md` ainda cita a "média do aluno" como critério de fora da curva** (correção
      `2026-10-19-interface-parte-a`): é o desenho da aprovação de nota oficial, que não existe até o F6 (D46), e não
      contradiz o RF21, que trata da turma aberta. Quem reescrever a seção 1.4 quando a nota oficial entrar confere se o
      critério continua sendo esse, sem ranking nem média de turma por professor (D45, D64)
- [ ] **O script do tema em linha entra por hash quando o F16 servir política de segurança de conteúdo** (X1,
      tarefa 2.0): o `apps/web/index.html` tem um `<script>` em linha, sem `type="module"`, que escreve o `data-tema`
      no `<html>` antes do primeiro quadro (`educa.aparencia`; `src/tema.ts` repete a conta). Hoje o `Caddyfile`
      não serve nenhuma política (`Content-Security-Policy`), e o script roda. Com uma política de `script-src` sem
      `'unsafe-inline'`, o script precisa do hash `sha256` dele em `script-src`, calculado no build, e o teste de
      `tema.test.ts` (que extrai o script do arquivo) é o que garante que o hash e o arquivo continuam o mesmo. Sem
      o hash o tema volta a ser aplicado só depois do React, e a página pisca no escuro (RF3). Ao servir a política,
      conferir que o hash em `script-src` não abre caminho para `'unsafe-inline'`. E, junto, pôr no `docs/lgpd.md` uma
      linha que diga que o navegador guarda só preferência de aparelho (`educa.aparencia` e `educa.lateral-recolhida`),
      sem identificador, e que aponte para `docs/interface.md` seção 6: não é dado pessoal, e a tabela de dados não
      ganha linha
- [x] ~~Identidade visual (paleta, tipografia, logo)~~ — existe e está fora deste repositório:
      manual da marca Turmma, com caramelo `#E8732E`, azul-noite `#16233E`, creme `#FFF3E2` e
      papel `#FDFBF7` (D54). É a pele da landing page; a do produto é a da D72
- [x] ~~Landing page~~ — existe em `turmma.com` (fora deste repositório)
- [x] ~~Trazer a paleta, a tipografia e o logo para o repositório~~ — já estão em `mockups/`
      (`src/index.css` e `public/marca/`), e a A1 leva de lá para o `apps/web` (D72)
- [x] ~~O avatar de cada um dos três agentes~~ — decidido na D80 (12/10/2026): a cabeça da onça, com o anel na cor
      do agente, sempre com o nome da função e o selo "IA". Entra na X1 (`pele-e-casca`, tarefa 8.0)
- [x] ~~Grupos da lateral da coordenação (F3, validação, M2)~~ — decidido na D80 (12/10/2026): quatro lugares (Painel,
      Analista, Escola e Registros), com Privacidade dentro de Registros. Entra na X2 (`telas-da-coordenacao`)
- [ ] Identificar no 21st.dev o autor e a licença das peças que o Gabriel colou direto no
      mockup (área de soltar arquivo, miniatura de arquivo, pasta animada, `leaderboard-*` e as duas
      da HextaUI) e conferir a do calendário `vaib215/event-manager`, antes de qualquer uma entrar no
      código (P20)
- [ ] **Foco durante o pedido e ao trocar de tela** (`frontend-reviewer`, 13.0 da A1): o botão que fica `disabled` enquanto
      o pedido está no ar perde o foco para o `body` (medido em "Alocar", "Ver a prévia", "Ver mais nomes" e "Abrir o ano
      letivo"; vale para o `Botao` e o secundário de todas as telas, também as da operação), e abrir uma tela pela lateral
      ou por link não leva o foco ao `<h1>`. A 12.0 resolveu o primeiro no `SeletorDeEscola` com `aria-disabled`; falta o
      padrão no `Botao`, com o estilo do desligado, e o foco na troca de rota, na casca. E o erro de campo do `Campo` não
      tem região viva: quando o foco já está no campo com erro (Enter com o foco nele), o leitor de tela pode não ler.
      Na lista colada da Estrutura (`ListaDaTurma.tsx`), o alerta que volta porque o texto voltou ao recusado é
      `role="alert"` e é lido de novo (`AlertaSemFoco`), a rever em teste com leitor de tela (3ª rodada da 13.0)
- [ ] **Encerrar alocação pela tela** (`frontend-reviewer`, 13.0 da A1): a API tem `POST /v1/vinculos/:id/encerrar` e
      nenhuma tela o usa. O professor alocado na turma errada não se desfaz pela Estrutura, o vínculo `contestado` não
      oferece ação, e a turma com alocação não se exclui. Decisão de produto (o que a coordenação pode desfazer, e com
      que aviso ao professor), a levar para o `/validar` da A1
- [ ] **Listas da Estrutura sem virtualização** (`frontend-reviewer`, 13.0 da A1): turmas, disciplinas e alocações rendem
      até 1.000 cartões. Cabe numa escola do recorte (dezenas); rever se a alocação de uma escola passar de algumas
      centenas (regra 50, item 1). Junto: a Alocação lê até 1.000 vínculos e 1.000 professores e, acima disso, corta sem
      o aviso que turmas e disciplinas têm (`revisor-geral`)
- [ ] **O chip "da web" da conversa com IA** (`frontend-reviewer`, 10.0 da X1): a variante de borda tracejada não é
      desenhada porque nenhuma citação vem da web hoje (D68 nasce com a busca, no F9, desligada por padrão). Quando a
      busca entrar, o `ChipFonte` ganha a variante, com o link e o `Citacao` que o contrato passar a ter
      (`docs/interface.md` 10.2)
- [ ] **Texto de exemplo do `Campo` de linha única truncado a 360 px** (`frontend-reviewer`, 10.0 da X1): o placeholder
      "Tema" do `MotorFormulario` é cortado no `celular`; o `Campo` não mede o exemplo como a `CaixaPedido` faz. Peça
      de `componentes/ui/campos/`, fora da 10.0. Destino (retrospectiva da X1): a tarefa da X3 que usar o `Campo`
- [ ] **A demonstração `data-tabela-estreita` da galeria mostra a tabela em modo largo** (`frontend-reviewer`, 10.0 da
      X1): a 280 px (`apps/web/src/galeria/secoes/superficies.tsx`) corta "AGENTE E FUNÇÃO". Peça de outra tarefa
- [ ] **`violacoesDasSecoes` repete o `violacoesGraves`** (`test-engineer`, 10.0 da X1): `e2e/pecas-ia.spec.ts` tem um
      axe por seções que repete a lógica do helper de `e2e/__fixtures__/verificacoes.ts`; o helper passaria a aceitar a
      lista de seções. O helper é de outros specs e ficou fora da 10.0
- [ ] **`CLASSES_DA_OPCAO` da `Escolha` repete a cor do secundário** (`revisor-geral`, 10.0 da X1): a face, a borda e o
      desligado são os de `botao-secundario.ts` (`COR_DO_SECUNDARIO`, `DESLIGADO`). Exportar de lá e compor evita a
      cópia que diverge; o arquivo é de todo `Botao` e ficou fora da 10.0
- [ ] **A caixa desligada do Tutor, quando entrar numa tela** (`conformidade-reviewer`, 10.0 da X1): conferir que o
      texto do campo desligado não pede ao aluno que espere ou volte (regra 70, item 4b). Hoje só existe na galeria
- [ ] **A caixa desligada no tema escuro não se distingue pelo fundo** (`frontend-reviewer`, 10.0 da X1): `fundo-suave`
      e `campo` têm o mesmo valor no escuro (`apps/web/src/estilos.css`), e o campo desligado da `CaixaPedido` só se
      diferencia pelo texto `apoio`. Dar um sinal que não dependa do fundo; o `Campo` desligado tem o mesmo par de tokens
      (`docs/interface.md` 10.2). Muda peça que a 6.0 revestiu. Destino (retrospectiva da X1): correção própria, com o
      `frontend-reviewer`, antes da X4, que é onde a caixa desligada entra numa tela (o Tutor do aluno)
- [ ] **Teste do desfazer da `CaixaPedido`** (`test-engineer` e `revisor-geral`, 10.0 da X1): em
      `CaixaPedido.test.tsx › apagar o pedido não escreve no campo`, o teste redefine `value` por cima do rastreador do
      React, então a regra de verdade é a do Ctrl+Z do e2e (`e2e/pecas-ia.spec.ts`); dizer isso num comentário, e trocar
      o `toBeLessThanOrEqual(1)` por `escritas` igual a `['']`
- [ ] **Classes do campo e do espelho da `CaixaPedido` escritas duas vezes** (`revisor-geral`, 10.0 da X1): letra e
      respiro do `textarea` e do espelho repetem as mesmas classes; uma constante única. Hoje o teste "o espelho é só para
      medir" segura a igualdade
- [ ] **`TITULO_DA_NOVA_CONVERSA` guarda `'Início · Turmma'`** (`privacy-guardian`, 12.0 da X1): o nome da constante
      (`e2e/__fixtures__/casca.ts`) é o do rótulo antigo. Renomear (para `TITULO_DO_INICIO`) quando os specs que a usam
      forem mexidos de novo; ela é lida por specs fora da 12.0
- [ ] **Comentários "Nova conversa" em specs fora da 12.0** (`test-engineer`, 12.0 da X1): `e2e/inatividade.spec.ts:50`,
      `convite.spec.ts:187`, `entrar.spec.ts:44`, `escola-e-vinculos.spec.ts:57` e `:146`, `operacao.spec.ts:327`,
      `professores.spec.ts:507`, `professor-assistente.spec.ts:68` e `__fixtures__/fluxo-do-professor.ts:34`. Trocar por
      "Início" quando cada arquivo for mexido (mexer só no comentário caduca a revisão de spec que não é da 12.0)
- [ ] **O trilho da coordenação não tem folga a 600 px** (`frontend-reviewer`, 12.0 da X1): a 1366 × 600 o "Sair" passa em
      `toBeInViewport({ ratio: 1 })` por pouco, e o trilho não rola (a dica `absolute` seria cortada). Um oitavo lugar na
      coordenação derruba o "Sair" da janela; reabre com o oitavo lugar, ou com a barra de baixo da 13.0 mexendo no trilho
- [ ] **A lateral da coordenação a 1366 × 768 corta "PRIVACIDADE" pela metade** (`frontend-reviewer`, 13.0 da X1): o pé de
      240 px toma a altura (`CascaDaEscola.tsx`, a lateral aberta e o pé). É da 12.0 e muda o desenho da lateral; entra na
      X2 (`telas-da-coordenacao`), que reduz os lugares da coordenação a quatro
- [ ] **Celular deitado (~640 × 360): a barra de topo e a de baixo tomam 124 px dos 360 px** (`frontend-reviewer`, 13.0 da
      X1). Pede um projeto de paisagem que não existe; abrir quando houver (D51)
- [ ] **A escola na barra de topo é texto: o professor com duas escolas troca abrindo a gaveta, um toque a mais**
      (`frontend-reviewer`, 13.0 da X1). Segue `docs/interface.md` 11.1 e a regra 50, item 13; muda desenho, e entra na X3
      (`telas-do-professor`)
- [ ] **A barra de topo `sticky top-0` de 56 px não tem `scroll-padding-top`** (`revisor-geral`, 13.0 da X1): no
      Shift+Tab o foco que o navegador rola para cima para atrás dela, o mesmo problema que a barra de baixo tinha embaixo
      (resolvido na 13.0, com `scroll-padding-bottom`). Existia antes da 13.0 e muda comportamento: correção própria
      (`/corrigir`), com e2e a 360 px que leve o foco por Shift+Tab ao meio de uma tela comprida
- [ ] **A lista do perigo cheio é por arquivo, e o detector é textual** (`test-engineer`, 7.0 da X1): um segundo uso do
      perigo cheio num arquivo já listado passa, e o detector não vê `classesDoBotao(opcoes)` com o objeto montado antes
      nem a prop vinda de um spread. Contar os usos por arquivo e ler a sintaxe fecha os dois; pede mutação nova
- [ ] **A ordem dos botões do rodapé difere entre as peças** (`frontend-reviewer`, 7.0 da X1): o formulário e a
      `ConfirmacaoDePerigo` põem a ação primeiro; o `DialogoDeConfirmacao` e o painel, "Cancelar" primeiro. Tarefa
      própria: mexer na ordem mexe no Tab de seis telas de área ("Divergências resolvidas" do `7_task.md`)
- [ ] **Texto técnico na galeria** (`frontend-reviewer`, 7.0 da X1): "O Esc de dentro do menu fecha só o menu". Página
      interna sem link do produto (`caminhos.ts`); reescrever só se a galeria virar referência para o Gabriel
- [ ] **O botão oficial da confirmação é provado só como "não vermelho"** (`test-engineer`, 7.0 da X1):
      `e2e/pecas-sobrepor.spec.ts:601-604`; comparar com o token do `oficial` prova a cor certa
- [ ] **O Tab preso do login por cima não passa do fim da ordem** (`test-engineer`, 7.0 da X1):
      `e2e/inatividade.spec.ts:112-114`; repetir o Shift+Tab a partir do foco inicial, como na confirmação. Anterior à X1
- [ ] **`QUEM_IMPORTA_O_AVATAR` ainda deixa a `Mensagem.tsx` importar o avatar** (`revisor-geral`, 8.0 da X1): fechar só
      na `AssinaturaIA`, com o aperto escrito na `techspec.md` 7b da X1 e na lista do teste. Muda contrato escrito: é do
      Arquiteto. Destino (retrospectiva da X1): correção própria, com o `conformidade-reviewer`; aperta a guarda e não
      muda desenho, e o aperto se escreve no `docs/interface.md`, porque a Tech Spec da X1 está fechada
- [ ] **A casca do selo da `AssinaturaIA`** (`revisor-geral` e `test-engineer`, 8.0 da X1): o espaço entre o nome e o
      selo é feito duas vezes (`{' '}` e o `ml-1`; ficar com um), e o `align-middle` não tem asserção. Acabamento; a
      tarefa que tocar a `AssinaturaIA` fecha as duas
- [ ] **O filtro de `has-` da caixa do motor só olha o rótulo desmarcado** (`test-engineer`, correção
      `2026-10-15-anel-do-motor-sem-has` da X1): `apps/web/src/componentes/ui/ia/pecas-revestidas.test.tsx:150`; repetir a
      asserção depois do clique que marca a caixa. O E5 do `casca.spec.ts` cobre o CSS inteiro na esteira; vale na
      próxima tarefa que tocar este teste
- [ ] **O que a 11.0 da X1 deixou para as telas de cada área** (`revisor-geral` e `frontend-reviewer`, `11_task.md`):
      a prop `objeto` da `Tela` ficou sem efeito e ainda é passada por `Atividade`, `Aprovar`, `Ferramenta`, `Artefato`,
      `DetalheDoPedido` e a galeria (tirar ao recompor cada uma); o campo de arquivo da `ListaDaTurma` é o nativo do
      navegador, e o `Material` usa botão próprio (X2); `h1` seguido de `h2` quase igual em `Turmas` e em `Professores`
      (X2 e X3); e o voltar de `Turma` e `ListaDaTurma` ainda é link sublinhado, e não linha própria de 28 px em `t-selo`
- [ ] **Lacunas de teste que a validação da X1 deixou às tarefas da X2 e da X3** (`tasks/prd-pele-e-casca/validacao.md`,
      rodada 1, "Menores"): o percurso de `e2e/titulo-da-tela.spec.ts` só cobre `Seções`; o `aria-current` de "Seu time"
      sem teste; as medidas de 256/88, 56 e 68 px só com o professor, e 88 sem medida a 900 px; o "Sair" da operação sem
      comparação com o vizinho (RF15); o hover do oficial sem comparação (RF6); as linhas "selo de IA" e "aprovado" de
      `contraste.test.ts` presas só pela contagem; a guarda de movimento sem `@keyframes`; o Tab da galeria só nos
      botões. E o botão "Abrir dado nominal de uma turma" quebrando em duas linhas a 360 px (X2, tarefa 4.4). Cada um
      entra na tarefa que mexer na peça
- [ ] **O que o `test-engineer` deixou da correção da galeria da onça** (`tasks/correcoes/2026-10-16-galeria-da-onca-estoura-o-prazo.md`,
      "Recomendações"; validação da X1, rodada 3, "Menores"): (a) `medirBlocosDaGaleria` (`e2e/__fixtures__/galeria.ts`)
      deixa passar bloco com `display:none`, que o `caixa()` antigo reprovava: acrescentar a lista `semCaixa`, o que muda
      o contrato de `MedidaDosBlocos` e os `toEqual` dos testes; (b) o teste de `desenhos` monta borda e canto com
      atalhos (`border:`, `border-radius:`) que pintam os quatro lados iguais, e `desenhos` lendo `borderBottom*` no lugar
      de `borderTop*` não seria pego: dar um lado diferente dos outros. Os dois entram na próxima tarefa que tocar a galeria
- [ ] **Os quatro botões de `Introducao.tsx` com o mesmo componente `Botao`** (`revisor-geral`, 1ª rodada da 5.0 da X4,
      `tasks/prd-telas-do-aluno-e-primeiro-acesso/5_task.md`): "Continuar" e "Pular" são `<button>` com `classesDoBotao`, e
      "Fechar" e "Sair" vêm da `TelaDeFoco`; usar o `Botao` nos quatro é refatoração sem efeito para quem usa, e mexe no DOM
      que o teste de RF16 e o bloco de Mutações com `opacity-70` citam. Entra na tarefa da X4 que mexer na `Introducao`
      depois da 9.0, com os testes e as mutações refeitos

## Comercial

- [ ] Planilha de custo de IA por aluno/mês **por pacote** → validar a margem das faixas
      (D50) e fixar o teto de IA do pacote base (D39)
- [ ] Entrevistas com 6 a 8 escolas de Joinville (coordenação e professores, particular e
      pública): como medem o professor hoje e o que ele aceitaria, onde está a grade, que
      material usam e com que licença, se têm Google Workspace ou Microsoft, qual sistema de
      gestão, quem pagaria, quanto e quando
- [ ] Escola piloto gratuita para o 1º semestre de 2027, com carta de intenção (D1 revista;
      contatos existem, nada decidido com base neles)
- [ ] Confirmar com advogado o calendário de repasse na mensalidade (Lei 9.870/1999) antes de
      prometer preço para 2027
- [ ] Levantar o número de alunos da rede pública no recorte (anos finais municipais e
      estaduais, Ensino Médio estadual) e o preço praticado em pregão
- [ ] Roteiro de demonstração para coordenador e para assembleia de pais, com o checklist do
      MEC respondido na mão (`docs/conformidade-mec.md` seção 2)
- [ ] **Evidência independente de eficácia pedagógica**: desenhar com a escola piloto uma
      medição simples e pré-registrada (tempo de preparação e correção do professor antes e
      depois; desempenho por habilidade com e sem uso), com alguém de fora assinando o
      desenho. O MEC pede pesquisa **não financiada pelo desenvolvedor**, e sem isso o
      primeiro critério de avaliação de qualquer secretaria fica em branco
- [ ] **Material de formação do professor**, exigido pelo princípio 4 e pelo critério 3 do
      MEC. Não temos nada, e é a isca comercial mais barata que existe
- [ ] Perguntar à secretaria de Joinville se existe ou pode existir **chamamento público para
      sandbox regulatório** — é o formato natural do piloto gratuito de 2027 e não passa por
      licitação (`docs/conformidade-mec.md` seção 10)
- [ ] Aproveitar setembro como pico de compra para o ano seguinte (em 2026, para
      entrevistas e piloto; venda com repasse, realisticamente, para 2028)

## Marca

- [x] ~~Nome definitivo~~ — **Turmma** (D54)
- [ ] Busca e depósito no INPI da marca Turmma, e registro do domínio `turmma.com` (e do
      `@turmma.ai`). É o único risco que sobra do nome: se o INPI negar, a troca é de marca,
      não de código
- [ ] **(D80) Parecer sobre a pele nova, junto do INPI:** a pele toma a técnica visual do Duolingo (ilustração chapada,
      botão com degrau), com mascote, cores, ícones e fonte nossos. Confirmar com advogado que não há risco de
      concorrência desleal (a D72 recusou a cópia da Teachy por isso), antes do material de venda (Gabriel e Joaquim)
- [ ] **(D80) A onça como avatar de agente conversacional para menor:** levar ao advogado, com o parecer do ECA
      Digital (Decreto 12.880, arts. 10 e 11). As condições que a spec fixa estão na D80, item 3; as poses e a
      comemoração da X4 dependem do mesmo parecer (Joaquim)
- [x] ~~**(D80) Trazer o mockup de outubro para `mockups/`**~~ — decidido pelo Joaquim em 16/10/2026 ("sobre o
      mockup pode trazer para o projeto aqui"): `mockups/` é agora a cópia de `Prototipo_Turmma` em `a95568d`, com a
      mesma cerca da versão de setembro, sem `node_modules`, e três linhas reescritas para o gitleaks
      (`mockups/README.md`). O mockup não cola peça nova do 21st.dev; a conferência da licença (P20, item da seção
      "Marca e interface") continua aberta, antes de qualquer peça entrar no código
- [ ] **(D80, revisão das specs X2 a X4) O que os guardiões mandaram para fora das specs:** (a) a tela Material relê a
      cada 1,5 s enquanto houver material `processando`, e a ingestão pode esperar horas na fila de lote: rever o
      intervalo (`api/material.ts`; `infra-guardian`, X2); (b) `orcamento.consultar` e `usoDeHoje` contam as trocas do
      dia duas vezes na mesma requisição de `GET /v1/tutor/conversa` (`infra-guardian`, X4); (c) uma contagem agregada
      de pedidos de nome por professor, na API, tiraria do sino do professor as até 12 leituras por turma
      (`infra-guardian` e `privacy-guardian`, X3); (d) o texto "Aprovado por gente", na governança, soa estranho: a
      X2 recompõe a tela (`frontend-reviewer`, tarefa 1.0 da X1); (e) o staging precisa servir `/assets/*` com cache
      longo e o `index.html` sem cache, porque o script do tema mora nele (`infra-guardian`, X1)
- [ ] **(D80) Decisões que tomei por delegação nas specs X2 a X4, para o Joaquim rever:** estão na seção 12 da Tech
      Spec de cada uma (12b na X4). As que mudam o desenho do mockup: a onça fora do vazio do sino (X2); o aviso de
      atenção humana em Hoje sem nome, com "Ver quem", e o "Acesso gerado" em tela inteira (X3); o Início do aluno
      sem "Hoje: N de 60" e sem os avisos de pausa, a introdução "uma vez só" com ressalva, o texto do aviso de
      privacidade e a onça de rosto neutro, com comemoração só na entrega (X4)

## Fase posterior

- [ ] Iniciar aprovação da API oficial do WhatsApp (prazo de semanas — comece antes de precisar)
- [ ] Portal da família sobre o motor de eventos

## Antes da primeira escola real, vindo da revisão da fase 1 do MVP de apresentação (04/10/2026)

O MVP de apresentação corre com dado sintético (D71, D77). Os revisores apontaram o que precisa existir antes de
qualquer dado real:

- [ ] **(X7, encontro-6-harness) Traço do e2e em `pull_request` de repositório público:** o `ci.yml` sobe o traço do e2e que
      falhou também no `pull_request`, e o repositório é público. Hoje o dado é sintético; antes da primeira escola real, conferir
      que nenhum seed com dado real chegue a esse job (ou que o upload do traço deixe de rodar em PR).
- [ ] **(F3, 13.0) `STORAGE_URL_PUBLICA` no staging e na produção:** a URL assinada do arquivo do titular leva o host na assinatura,
      e o compose local aponta para `127.0.0.1:${STORAGE_PORTA_HOST}`. Quando o staging for criado (D42), a variável tem de ser o
      endereço `https` do storage gerenciado que o navegador alcança, e a API não deve subir com `AMBIENTE=staging` ou `producao`
      sem ela (hoje cai no endereço interno, que não abre fora da rede). Entra junto da escolha do provedor de hospedagem.
- [ ] **(F3, 13.0) Índices `auditoria_escola_autor_idx`, `consumo_ia_execucao_idx`, `resposta_atividade_aluno_idx`,
      `registro_acesso_usuario_idx` e `correcao_destaque_aberto_por_idx` com `concurrently` antes do staging:** as
      migrations 0033 e 0034 os criam sem `concurrently`, como a Tech Spec do F3, seção 7c, aceita enquanto não há staging nem piloto.
      `auditoria` é a tabela que mais cresce: a partir do staging, o índice novo vai em arquivo próprio, fora de transação (junto dos
      pendentes das migrations 0025 a 0027).
- [ ] **(F3, 13.0) Limite de downloads da versão da escola (`privacy-guardian`, rodada 6 da revisão da spec):** a coordenação pode
      pedir a URL de 5 minutos quantas vezes quiser; cada pedido é auditado com autor e finalidade, e a versão só existe enquanto o
      titular está sem conta ativa. Um teto por versão e por dia não está nos requisitos (RF12) e ficou fora; se o Joaquim o quiser,
      entra com `LIMITE_DE_DOWNLOADS_DA_VERSAO_DA_ESCOLA` e erro tipado.
- [x] **(F3, 13.0) Pedido de acesso `em_preparacao` de titular que foi eliminado (F3, 15.0):** *resolvido na 15.0: a eliminação conclui os outros pedidos abertos do titular na mesma transação, cada um com `pedido.concluido`.* o job termina sem efeito quando o
      titular já não existe na escola (log `titular.arquivo_sem_titular`), e o pedido segue `em_preparacao` até a coordenação
      concluí-lo, e dispara o alerta de 2 h enquanto isso. A 15.0, que conclui o pedido de eliminação, decide se conclui os de acesso
      abertos do mesmo titular na mesma transação (o autor `rotina` já vale para `pedido.concluido`).
- [ ] **(F3, 13.0) Pedido `em_preparacao` cujo job `falhou` não volta sozinho:** o BullMQ esgota as tentativas e o job fica
      `falhou`; o runbook manda concluir o pedido e registrar outro. Um reenfileiramento pela rotina da noite (os `em_preparacao` com
      mais de 2 h, uma vez, com chave de idempotência) tiraria o passo manual; fica para depois da primeira escola real, com o número
      de casos que aparecerem.
- [ ] **(F3, 13.0) Corrida entre o expurgo do arquivo e o job repetido:** o expurgo apaga o objeto, o job repetido o regrava e faz o `on conflict do update` na mesma linha, e o expurgo apaga a linha: o objeto fica órfão no storage, com dado do titular, sem ninguém que o varra. Rara (job repetido depois de pronto, na noite do 8º dia), mas é dado de menor fora do prazo. Saídas: `apagarLinhas` só apaga se `expira_em`/`apagado_em` ainda forem os lidos, ou o expurgo trava a linha (`for update skip locked`) antes de apagar o objeto (`infra-guardian`, 1ª rodada da 13.0).
- [ ] **(F3, 13.0) Índices que faltam por turma:** `entrega (decidida_por)`, `atividade_aplicada (aplicada_por)` e `validacao_do_lote (confirmada_por)` são lidos pelo arquivo do professor e não têm índice; crescem por turma, não por aluno. Avaliar com volume real, junto dos três da migration 0034 (`infra-guardian`, 1ª rodada da 13.0).
- [ ] **(F3, 13.0) `apagarArquivosDoTitular` repete o mesmo objeto que falhou em cada lote e soma `naoApagados` mais de uma vez para ele:** guardar os ids que falharam e tirá-los da leitura seguinte do lote (`infra-guardian`).
- [ ] **(F3, 13.0) Um cliente S3 só entre o núcleo e o worker:** `criarClienteS3` (worker) e `criarClienteDoArmazem` (núcleo) são duas fábricas; o `worker-lote` abre dois clientes. Juntar na do núcleo, com os prazos por configuração (`revisor-geral`).
- [ ] **(F3, 13.0) O prazo de requisição do medidor de storage só avisa:** `criarClienteS3` (`apps/worker/src/storage/medidor-de-storage.ts`) passa `requestTimeout` ao handler do SDK sem `throwOnRequestTimeout: true`, e nessa versão do handler (`@smithy/node-http-handler` 4.x) o prazo estourado vira só um aviso: o storage que aceita a conexão e não responde segura a medição sem limite. `criarClienteDoArmazem` foi corrigido na 13.0; este fecha junto do item acima, quando as duas fábricas virarem uma (diagnóstico do Arquiteto, 2ª rodada da 13.0).
- [ ] **(F3, 13.0) Índice redundante em `pedido_titular`:** `pedido_titular_da_escola_unico (escola_id, id)` repete o `pedido_titular_escola_id_idx`; contrair o segundo numa migration futura (`revisor-geral`).
- [ ] **(F3, 13.0) Testes do arquivo que prometem mais do que afirmam, e três provas que faltam (`test-engineer`):** (i) o teste de conteúdo não prende o SQL à declaração (as chaves de cada linha do JSON contidas em `LEITURAS_DO_ARQUIVO[t].colunas`); (ii) "B não lista A" usa outra pessoa em B, e não o mesmo professor logado em B (`sessaoDaMesmaConta`); (iii) virada de ano letivo: um registro de ano anterior tem de aparecer no arquivo, e hoje um filtro por `ano_letivo_id` nas leituras passaria; (iv-bis) o `POST pedidos/:id/arquivo` no pedido sobre a própria pessoa da coordenação (usuário desativado com a mesma `conta_id` de quem chama) cai no `#pedidoAlvo`, e nenhum teste prova isso nesta rota; (iv) os títulos "com ou sem segundo fator" (token só) e "cada arquivo uma vez" (não conta as chamadas de `apagar`) prometem mais do que afirmam.
- [ ] **(F3, 13.0) Duas perguntas de alcance do arquivo para a Tech Spec antes da 18.0 (`privacy-guardian`, `conformidade-reviewer`):** (i) a versão completa do professor com conta ativa traz `consumo_ia.entrada/saida` e `mensagem_agente.conteudo` também de turmas cujo vínculo já terminou (regra 20, item 18): é texto que ele escreveu, mas o prompt do Analista pode levar ids e desempenho de alunos que ele já não alcança; (ii) `artefato.titulo` entra na versão da escola do professor sem conta ativa: se o título vier do tema que ele escreveu ao Assistente, é um pedaço da conversa dele chegando à coordenação (regra 70, item 8); hoje está coberto pela exceção "registro de uso (execuções, consumo sem texto e artefatos)" do PRD, seção 6.
- [ ] **Ressalvas da 14.0 (F3, `test-engineer`, `infra-guardian`, `revisor-geral`, 1ª rodada):** (i) `temAcessoSuspenso`: os filtros `isNull(desativadoEm)` e `ne(papel, 'aluno')` não têm teste que os derrube (hoje inalcançáveis); (ii) o `Cache-Control: no-store` e o corpo vazio do `cancelar` não são afirmados; (iii) os [P] de `eliminacao-agendada.int.test.ts` (dois `cancelar`, duas chaves, cancelar e registrar) usam `Promise.all` sem forçar o entrelaçamento: segurar a primeira transação com `GatilhoDeParada` e `esperarNaTrava`, como `retencao.int.test.ts`; (iv) falta o [P] da eliminação com a **mesma** chave de envio nas duas chamadas: o `ON CONFLICT` só arbitra `(escola_id, chave_envio)` e o único parcial `pedido_titular_agendado_unico` é outro índice, então numa janela curta o reenvio pode receber `PEDIDO_EM_ESTADO_INVALIDO` em vez do mesmo pedido (a tela 16.0 sorteia a chave por diálogo); (v) o ramo suspenso do login por e-mail não grava a falha no registro de acesso (`gravarFalhaDeLoginPorEmail`), e os da matrícula e da conta externa gravam: alinhar, com teste do registro de escola nula; (vi) em `login.service.ts`, a consulta `temAcessoSuspenso` roda fora do `.catch` que chama `contador.desfazer`: se o banco falhar ali a reserva fica contada como senha errada; (vii) a renovação recusada por eliminação agendada entra na métrica como `recusada`: separar `suspensa` em `RESULTADOS_DA_RENOVACAO`; (viii) a sessão que um agendamento anterior, já cancelado, encerrou com `motivo = 'eliminacao_agendada'` volta a receber `ACESSO_SUSPENSO`, e não o 401, se a pessoa for agendada de novo dentro das 12 h e da inatividade: comparar `encerradaEm` da sessão com o `eliminacaoAgendadaEm` atual e cobrir com teste (cancelar, agendar de novo, usar o cookie antigo); risco pequeno, o cookie é da própria pessoa, da mesma escola; (ix) o teste da inatividade da renovação usa `now() - 1 day` e deve provar a fronteira (logo depois de "inatividade do papel + tolerância"), como `avaliar-sessao.test.ts` faz para a guarda; (x) no teste do aluno transferido, comparar também o `setCookie` da renovação com o do desconhecido, e dizer em comentário que é cenário de comportamento (passa por duas defesas: o motivo `desativacao` e `desativadoEm` em `sessaoAindaVale`), e não a prova de uma cláusula.
- [x] **Acesso e portabilidade do titular cobrindo as tabelas da fase 3.** *Resolvido: o arquivo (13.0, `LEITURAS_DO_ARQUIVO`) lê cada uma, e a eliminação (15.0) as alcança pelas FKs (`mensagem_tutor`, `sinal_tutor` e `tentativa_atividade` em cascata, `consumo_ia` com o aluno nulo); teste em `apps/worker/test/expurgo-da-escola.int.test.ts` (desativado com trabalho, conversa e consumo) e em `eliminar-titular.int.test.ts`.* A rota do pedido do titular (F3,
  `ciclo-de-vida.service.ts`) precisa alcançar, por aluno: `mensagem_tutor`, `sinal_tutor`, `resposta_atividade`,
  `tentativa_atividade`, `correcao`, `validacao_do_lote` (o aluno do destaque, pelo id) e `consumo_ia` com
  `envio_externo` (o que foi a provedor externo e quando), para a pergunta de fechamento da regra 20 continuar
  respondida por código (`privacy-guardian`, revisão da fase 3).
- [ ] **Trava da D62 em código.** A marca "leva texto de aluno" da camada de IA não tem consumidor: texto de aluno com
  envio externo e sem contrato que vede treinamento e garanta processamento no Brasil precisa ser recusado
  (`privacy-guardian`).
- [x] **Expurgo** de `consumo_ia` (`entrada` e `saida`), de `execucao_agente` e das conversas, no prazo do mapa de
  `docs/lgpd.md`, configurável por escola. Feito no F3: as conversas e os sinais saem (tarefa 3.0), a execução, o texto
  do modelo, o aluno do consumo e a autoria do artefato perdem a pessoa (tarefa 4.0), e o trabalho do aluno, a
  reivindicação decidida, o material excluído, o vínculo encerrado e a pessoa desativada saem (tarefa 5.0), pelo
  `retencao.expurgar-escola`.
- [ ] **Função nova pedida pelo aluno e o expurgo:** o lote `execucao_agente_do_tutor` filtra por
  `funcao = 'tutor_com_o_aluno'`, a única que o aluno pede hoje (`FUNCOES_COM_ORCAMENTO_POR_ALUNO`). Pôr um teste que leia
  essa lista e confira que cada função tem alvo e índice de anonimização, antes de existir a segunda (`privacy-guardian`
  da F3, tarefa 4.0)
- [ ] **Reenvio da chave de uma execução já anonimizada:** a API devolve `NAO_ENCONTRADO` (a releitura filtra por
  `solicitada_por`, que ficou nulo), e nenhum teste de integração prova que não é 500 nem execução nova. Pôr o teste,
  no Assistente e no Tutor, quando o fluxo for revisto para a escola real (`llm-integrator` da F3, tarefa 4.0)
- [ ] **Aviso no campo de tema** das ferramentas, para não escrever nome nem condição de aluno, e busca textual nos
  campos livres no procedimento de eliminação do titular.
- [ ] **Recusa do Tutor medida.** Conjunto fixo de amostras com taxa mínima declarada, rodado contra o modelo de
  produção (regra 40). A regra determinística cobre o que está no arquivo de amostras; o resto fica com o modelo, e
  para aluno real isso não basta sem medição (`conformidade-reviewer`).
- [ ] **Teto de IA por escola e custo.** Não há coluna de teto nem tabela de preço: `IA_ORCAMENTO_ESGOTADO` nunca
  dispara e `custo_micros` fica em zero (D14, D39).
- [ ] **Galeria das peças fora do build** de staging e de produção.
- [ ] **Execução de IA e extração de PDF por fila**, no lugar do processo da API (`TODO(fila)`, D49).
- [ ] **Recusa da D55 no Assistente, estrutural.** A regra por lista de palavras pegou 6 de 47 frases novas escritas
  pelo `conformidade-reviewer` na segunda passada da fase 3 (04/10/2026): foi ajustada às amostras. Para a demonstração
  ela foi aceita; antes de dado real: texto colado na mensagem atual não vai ao modelo, ou é recusado quando não é
  material do próprio professor; a conferência da saída recusa número de 0 a 10 ou letra de A a E depois de "sugiro",
  "colocaria", "iria de", "fecharia em", "classificaria", e "considero" ou "avaliação:" seguido de insuficiente,
  regular ou satisfatório; a entrada cobre a trajetória do aluno ("reprovo", "recuperação", "conselho de classe",
  "encaminho"); e um terceiro arquivo de amostras, escrito por outra pessoa, com a taxa medida e declarada abaixo de 1.
  Falso positivo conhecido: "critérios para avaliar redação antes de aplicar" é recusado.
- [ ] **Assunto delicado sem teto de IA.** Agora passa na frente de todo limite (D36). Falta um teto próprio, alto, ou a
  deduplicação do sinal `atencao_humana`, para um laço de mensagens não encher a lista do professor; e confirmar que o
  limite geral de requisições por escola, o da borda, não chega antes do 188 às 10h.
- [ ] **Servidor do e2e sem compressão nem cache.** O `vite preview` manda o JS cru e sem cache, e o teste
  `e2e/areas.spec.ts:163` roda a 28,5 de 30 s no perfil celular, gastando o tempo em recarregamentos. Servir o build do
  e2e comprimido e com cache, como a produção, é mudança de infra (contêiner `web` e borda), com `test:infra`.
- [ ] **Ensaio de alertas intermitente** na esteira: a regra "Login recusado pelo semáforo do hash" ficou em `pending`
  até o prazo numa execução da `mvp/apresentacao` e passou na reexecução. Se voltar, entra por `/corrigir`.
- [x] ~~**E2e intermitente "segunda pessoa"** (`e2e/areas.spec.ts:381`, chromebook e celular): na esteira `37302975647` a
  coordenação entrou na aba do professor e "Turmas" mostrou o estado vazio ("A coordenação ainda não alocou você") em vez
  da turma da professora, e passou na reexecução, sem mudança de código. Voltou no projeto `celular` na esteira
  `37324214757` da `develop` (`e98a21b`, merge do PR #2, que só mudou `.md`), com o mesmo estado vazio no lugar da
  turma; o job e2e 3/4 foi reexecutado. É o quarto e2e intermitente da `mvp/apresentacao` em
  torno da página inicial do professor e da troca de escola (os outros são "W4: os estados de Turmas" e os dois da troca
  de escola no celular): vale um `/corrigir` que olhe os quatro juntos antes de a esteira da `develop` voltar a
  ser por commit.~~ — corrigido em `tasks/correcoes/2026-10-05-segunda-pessoa-cache-dos-vinculos.md`. Falhou também na
  reexecução e no chromebook da `37330163372`. A causa era a alocação criada depois de a Nova conversa já ter lido os
  vínculos, que ficavam 30 s no cache: o teste agora aloca antes de entrar (20 de 20 depois). O W4 (10 de 10) e a troca
  de escola (80 de 80) ficaram estáveis sem mudança; os dois da troca de escola já tinham sido corrigidos no `ad7c3f0`.
- [ ] **E2e "W4: os estados de Turmas" sem causa conhecida** (`e2e/areas.spec.ts:315`). Declarado intermitente no plano
  do MVP (`docs/mvp-rapido.md`, seção 8, item 3), e o item acima era o único que o acompanhava. Não reproduziu em 10
  execuções em 05/10/2026, e o código dele não tem a corrida do "segunda pessoa": aloca depois de entrar, mas relê pelo
  "Tentar de novo". Se voltar, entra por `/corrigir` com a execução da esteira em que falhou.
- [x] **E2e "duas abas" do acesso suspenso** (`e2e/acesso-suspenso.spec.ts`, `chromebook`, esteiras 38990594424 e 39037075898).
  A hipótese do teto de 30 s (`test.slow()`) estava errada: o trace mostrou a segunda aba pedindo antes da primeira, com
  as leituras da Nova conversa ainda a caminho quando a marca foi ao banco. A hipótese foi revista duas vezes: o trace
  mostrou duas leituras (vínculos e time), e a auditoria do `test-engineer` achou a terceira (`/v1/entregas`). Corrigido em
  `tasks/correcoes/2026-10-17-duas-abas-do-acesso-suspenso.md` (a segunda aba só é devolvida com nenhuma requisição a caminho).
- [ ] **`abrirSegundaAbaQuieta` do acesso suspenso: duas folgas** (`test-engineer`, 2ª rodada da correção
  `2026-10-17-duas-abas-do-acesso-suspenso`). (1) O `expect.poll` pode ler zero entre uma resposta e uma consulta que dependa
  dela: se a Nova conversa ganhar consulta com `enabled` dependente, exigir zero em duas leituras seguidas. (2) Falta a prova
  de que o atraso pegou: um `expect` de que o `Set` de requisições teve mais de um item quando a saudação apareceu; hoje quem
  prova é o vermelho da mutação, no portão.
- [ ] **Alocação nova demora até 30 s para aparecer em "Turmas"** (`test-engineer` da correção
  `2026-10-05-segunda-pessoa-cache-dos-vinculos`). Não é requisito hoje, mas o vazio da Nova conversa manda a professora
  a "Turmas" ("Ir para Turmas", `apps/web/src/areas/professor/inicio/Home.tsx`), que monta com a lista que a Nova conversa já
  leu (`staleTime` de 30 s em `apps/web/src/api/cliente-de-consultas.ts`) e mostra "A coordenação ainda não alocou você";
  e esse vazio não tem como reler (`Turmas.tsx`), só trocando de aba ou abrindo a tela de novo. Se mudar (por exemplo,
  `refetchOnMount: 'always'` só na consulta de "Turmas"), o e2e que prova é "alocação feita com a Nova conversa aberta
  aparece em Turmas sem recarregar". Decisão de produto: Joaquim.

## O que o MVP fez diferente de uma decisão ou regra (05/10/2026, na propagação da D77)

Achados ao conferir o código depois do merge (`13eab64`). Não estão resolvidos: cada um pede decisão do Joaquim.

- [ ] **Consumo de IA no painel da operação.** A D76 e o "Pronto quando" da A2 no `ROADMAP.md` dizem que, com a A2, o
  painel da operação mostra o consumo de IA por escola, em tokens e em reais contra o teto por aluno. Não entrou: a API da
  operação (`apps/api/src/operacao/`) não lê `consumo_ia`, e `apps/web/src/operacao/paginas/Uso.tsx` ainda diz que o
  consumo "entra com a A2". A coordenação vê o consumo na Governança; a operação, não. Falta decidir em que fase entra.
- [ ] **Tutor sem política por turma (D19).** A D19 manda o Tutor fora da sala ser configuração da escola por turma,
  **desligada por padrão**. No MVP o Tutor fica ligado para todo aluno com turma, a qualquer hora: o estado `fora` existe
  no contrato e nunca é devolvido (`apps/api/src/tutor/tutor.service.ts`, `conversa`; decisão 27 de
  `docs/mvp-rapido.md`). Com dado sintético não expõe ninguém; antes de aluno real, a D19 precisa valer.
- [ ] **O aluno não vê nem contesta o que o Tutor sabe (D66; regra 70, item 4d).** A rota `GET /v1/tutor/memoria`
  existe, mas não há tela, e não há caminho de contestação (decisão 27 de `docs/mvp-rapido.md`). Antes de aluno real.
- [ ] **Sino da coordenação, três pontos que a 1.0 deixou (telas da coordenação).** (1) Em `carregando` com itens já lidos, o botão diz "Esperando você, N" e a lista só "Carregando…": decidir se mostra os itens lidos. (2) `GET /v1/vinculos` não filtra por papel: o sino lê os vínculos de aluno junto (`?papel=professor` e consulta própria). (3) Trocar de faixa de largura remonta o sino e fecha a lista (X-spec da casca).
- [ ] **Sino da coordenação, restos da rodada 2 (telas da coordenação).** Ajuste de texto da `techspec.md` §7c (a célula de carga descreve o sino duas vezes); mensagem de asserção explícita no `toBeGreaterThanOrEqual(0)` do e2e da troca de escola; `tools/vitrine` não captura o painel modal aberto (o Validador usa o e2e); nome da escola cortado ("Colégio s…") no celular (X-spec da casca).
- [ ] **`sino-por-area.test.tsx`:** a espera invertida de 300 ms depende de o teste de controle já ter carregado o `lazy()` do sino; carregar o código no `beforeAll` (telas da coordenação, 1.0).
- [ ] **`Abas` a 360 px (telas da coordenação, 3.0).** Em Escola a aba "Material" cai numa segunda linha. Mexe no layout do `Abas` para as quatro telas de abas (Escola, Registros e as que vêm), e não numa tela só: decidir se a linha rola de lado dentro do próprio contêiner ou se o rótulo encurta.
- [ ] **Sombra ou borda no pé do miolo que rola (telas da coordenação, 3.0).** Dá a pista de que há mais embaixo. É decisão de desenho do mockup e só faz sentido com a altura do miolo fechada (3.0).
- [ ] **Nome da escola cortado no cabeçalho do celular (telas da coordenação, 3.0).** A 360 px a barra de topo mostra "Colégio s…". Decidir junto com as abas do `Abas` a 360 px (item acima).
- [ ] **Analista: o "Gerar resumo" do alto durante a leitura (telas da coordenação, 4.0; frontend-reviewer e revisor-geral, 1ª rodada; test-engineer, 1ª e 2ª).** Hoje o botão do alto aparece enquanto `resumo.isPending`, um toque nessa hora já gera, e ele some quando o vazio chega (salto de layout). Esconder também na leitura muda o que o comentário de `Analista.test.tsx` diz ser intencional. Junto: a mutação 3 do `4_task.md` fica vermelha por `TypeError`, e `resumo.data?.resumo == null` esconderia o botão na carga sem teste nenhum perceber.
- [ ] **Analista: mínimo de alunos por recorte (telas da coordenação, 4.0; privacy-guardian, 1ª rodada).** Um recorte com "2 alunos" mostra o acerto (75%), perto do individual; a regra pede dois professores, e não diz quantos alunos. Decidir junto dos indicadores de desempenho, antes do piloto com dado real. Já existia antes da 4.0.
- [ ] **Analista: rotular a linha "Resumo gerado em…" como do Analista (telas da coordenação, 4.0; conformidade-reviewer, 1ª rodada).** No celular, rolada a página, o rótulo de IA não está à vista. Muda texto de tela: levar ao `/validar`.
- [ ] **Analista, e2e: o `dblclick` no botão ainda ligado (telas da coordenação, 4.0; test-engineer, 1ª rodada).** Hoje o teste do segundo toque clica duas vezes no botão já desligado; falta o caso do duplo clique no botão ligado, que prova a trava do ciclo (`comecarEnvio`) e não a do `disabled`.
- [ ] **Analista: falha do pedido saindo do vazio (telas da coordenação, 4.0; test-engineer, 1ª rodada).** Função suspensa e limite de pedidos: provar o `AvisoFila`, o botão do vazio voltando ligado e a tela sem dois primários. Teste novo; tarefa futura que toque `Analista.tsx`.
- [ ] **Analista, e2e: a espera de 20 s do recomeço quando a aba aborta o pedido (telas da coordenação, 4.0; test-engineer e revisor-geral, 2ª rodada).** `page.waitForResponse(...).catch(...)` leva o prazo inteiro se a aba abortou o pedido ao sair. Avisar no próprio `route` se o `fulfill` falhou e esperar o anúncio ou esse aviso, o que chegar primeiro. A 4.0 só anota qual dos dois caminhos rodou. E o terceiro caminho (revisor-geral e test-engineer, 3ª rodada): quando a anotação `resposta atrasada` diz "sem anúncio no prazo", a resposta nem chegou à aba nem foi abortada, e o teste passa sem ter provado nada; fazer esse caminho falhar, ou ao menos avisar. Pede decisão sobre o que fazer quando o aborto e o anúncio faltam.
- [ ] **A vitrine fotografa o miolo que rola e o seletor de arquivo em inglês (telas da coordenação, 9.0).** A foto de 1366 px da lista da turma corta a tabela dos nomes (a página não rola, o miolo rola por dentro), então a tabela só se vê no celular: rolar o miolo ou fotografar a região. E o seletor de arquivo sai "Choose File / No file chosen": fixar `locale: 'pt-BR'` no contexto do navegador da vitrine (`tools/vitrine/foto.ts`). É só da vitrine; o produto não muda.
- [ ] **Escola › Turmas: o que os revisores deixaram para o `/validar` e para outras tarefas (telas da coordenação, 5.0; frontend-reviewer, test-engineer e revisor-geral, 1ª rodada).** (1) Sinal de que a linha abre: o "›" do `mockup.md` seção 3 na última célula, ou o nome com a cor de link (`Estrutura.tsx`, `CLASSES_DO_LINK_DA_LINHA`): tarefa 9.0 ou `/validar`. (2) `position: relative` em `<tr>` falha em Safari anterior ao 16: conferir no `/validar`. (3) O "—" de Turno e Situação não diz nada ao leitor de tela; um texto escondido como "Sem turno" muda o nome acessível que "Nomes que não mudam" fixa: a validação decide. (4) Fotografar o Aviso "Para terminar a escola" e o vazio "Comece pelo ano letivo" quando a vitrine (`tools/vitrine/`) ganhar uma escola sem ano letivo. (5) Um e2e que siga "Ver o que falta" do sino e `PARA_O_ANO` do Painel (`sino-da-coordenacao.spec.ts:115`, `painel-da-coordenacao.spec.ts:144`) e veja o painel abrir: o `/validar` confere o caminho de ponta a ponta. (6) `daProfessor` (`turmas-da-escola.ts`) repete `'pendente' | 'confirmado'` de `ESTADOS_QUE_DAO_PROFESSOR` (`fila-da-coordenacao.ts:51`): exportar e usar nas duas. (7) `ProfessoresDaTurma.tsx:75` repete `'Nome não carregado'`: usar `NOME_NAO_CARREGADO`. (8) "Ver o que falta" e "Ano letivo e disciplinas" são `<button>` crus com `CLASSES_DO_BOTAO_SECUNDARIO`, e "Tentar de novo" usa `<Botao variante="secundario">`: o `/validar` decide a peça. (9) A `Secao` mora em `AnoEDisciplinas.tsx` e serve à página de Turmas: levar para `pecas-da-lista.ts`.
- [ ] **Escola › Turmas, restos da rodada 2 (telas da coordenação, 5.0; frontend-reviewer, revisor-geral e test-engineer, 2ª rodada).** (1) Vitrine (`tools/vitrine/foto.ts`): fotografar o menu da linha sem rolar, porque o `Menu` fecha na rolagem, e fotografar o da última e da penúltima linha, que abre para baixo sobre a linha seguinte (o clique sem `force` do e2e de Renomear, `estrutura.spec.ts`, prova o caso hoje). (2) O efeito do foco em `Estrutura.tsx` tem duas cláusulas, `painelAnterior.current !== undefined` e `painel === undefined`, que os testes não distinguem: passa a importar se a Estrutura um dia montar com os anos no cache e o foco no `body`; tarefa futura que toque `Estrutura.tsx`. (3) `e2e/estrutura.spec.ts`, caso "segunda pessoa": um comentário dizendo que a prova depende de a rota estar segurada (`portao`), e conferir o texto do vazio de Séries e de Disciplinas do painel de B, e não só `locator('li')` com contagem 0.
- [ ] **e2e de Privacidade: o prazo de 90 s repetido em três testes (correção 2026-10-17-abas-das-empresas-estoura-o-prazo; test-engineer, 1ª rodada).** `e2e/privacidade.spec.ts` declara `test.setTimeout(90_000)` em três casos (a troca de escola, as duas abas e os estados das empresas), cada um com o seu comentário de causa. Passar o prazo para o `describe` ou para uma constante nomeada, numa passada de limpeza do arquivo.
- [ ] **O miolo que rola corta o último bloco ao meio e nada diz que ali rola (correção 2026-10-17-pagina-rola-depois-da-12; frontend-reviewer e test-engineer, 1ª rodada).** A 1366 × 768 o miolo termina no meio do botão "Abrir dado nominal de uma turma", na Analista. Avaliar uma sombra de continuação no rodapé do miolo, nas três telas ao mesmo tempo (Escola, Registros e Analista, mais a lista da turma). Spec própria: mexe em telas que a correção não toca e muda a aparência.
- [ ] **O comentário de `e2e/areas.spec.ts:347-348` ainda diz que `paginaNaoRola` mede "Escola e Registros" (correção 2026-10-17-pagina-rola-depois-da-12; test-engineer, 1ª rodada).** O laço mede todas as telas da coordenação, o Painel e a Analista também. Corrigir o texto na próxima tarefa que tocar `e2e/areas.spec.ts`: mexer nele agora caduca o e2e.
- [ ] **A faixa do aviso de incidente soma `24px` à mão: o vão é o `gap-6` do `main` da casca (telas da coordenação, 13.0; revisor-geral, 1ª rodada).** `VAO_DA_FAIXA_PX`, em `AvisoDeIncidente.tsx`, copia o espaçamento do `main` de `CascaDaEscola.tsx`, e nada amarra os dois: mudar um deixa o outro errado e a página volta a rolar com a faixa. Medir até o próximo irmão, ou pôr o vão numa constante da casca que os dois usem.
- [ ] **"Quando o Turmma contratar" no vazio das empresas (telas da coordenação, 13.0; frontend-reviewer, 1ª rodada).** O texto de `EmpresasQueRecebemDados.tsx` concorda no masculino ("o Turmma"), e o resto do produto diz "a Turmma". Corrigir na próxima tarefa que tocar os `textos-*.ts`.
- [ ] **Cartões dos prazos de guarda no celular: o valor fica ao lado do rótulo mesmo quando passa de uma palavra (telas da coordenação, 13.0; frontend-reviewer, 1ª rodada).** Na `Tabela` em lista, o `dd` longo quebra em várias linhas à direita do `dt`. Fixar o valor embaixo do rótulo quando passa de uma palavra: muda o layout da `Tabela`, que várias telas usam.
- [ ] **O `Segmentado` tem 36 px no computador (telas da coordenação, 13.0; frontend-reviewer, 1ª rodada).** Passa na regra 50, item 2a (24 px), mas é a opção que troca a tela inteira da Privacidade. Avaliar 40 px: é do componente (3.0), com o `Segmentado.test.tsx`.
- [ ] **`e2e/incidentes.spec.ts`: o teste da Analista com o aviso adiado (telas da coordenação, 13.0; revisor-geral e test-engineer, 2ª rodada).** Na próxima tarefa que tocar o arquivo: juntar os dois `if (largura >= 768)` seguidos num bloco só; acrescentar um comentário de uma linha dizendo que no `celular` o teste só prova que nada rola de lado, porque `paginaNaoRola` encerra antes de 768 px; e incluir o `test.setTimeout(60_000)` local na passada de limpeza do item "e2e de Privacidade: o prazo de 90 s repetido…". Mexer agora caduca `test-engineer` e `revisor-geral`.
- [ ] **A folga de 12 px do miolo sem abas e o teste da faixa (telas da coordenação, 13.0; test-engineer, 2ª rodada).** O teste da Analista só põe a conta à prova enquanto a faixa tem mais de 12 px mais o vão (hoje cerca de 84 px). Se o desenho da faixa mudar (junto do item `VAO_DA_FAIXA_PX`), rever a margem do teste.
- [ ] **O diálogo do aviso de incidente a 1366 × 768 ocupa a altura toda e os botões ficam abaixo da dobra (telas da coordenação, 13.0; frontend-reviewer, 2ª rodada).** Os botões "Confirmo que recebi" e "Ver depois" ficam dentro da rolagem do diálogo. Avaliar rodapé fixo no `Dialogo` (propriedade `rodape`) ou disposição mais compacta: o `Dialogo` é componente de várias telas, e o `AvisoDeIncidente` não mudou nesta tarefa. O Validador pode vê-lo no `/validar`.
- [ ] **A lista de "O que a IA gerou" com `?estado=` custa candidatas × entregas da série: 30 s com 60 mil entregas (telas da coordenação, 10.0; `EXPLAIN` da tarefa).** `GET /v1/governanca/resumo?estado=rejeitada`, numa escola sintética com 60.004 entregas em duas turmas da mesma série, levou 30,2 s e leu 65 milhões de buffers: a subconsulta do grupo mínimo (D45) roda uma vez por entrega candidata (120) e cada vez lê e ordena em disco as 60 mil da série. `pendente` (24 mil candidatas) daria cerca de 100 minutos (conta, não medida). Com a D25 (até dez escolas) o volume é bem menor, mas o crescimento é quadrático e o filtro "Esperando o professor" é o primeiro a sentir. Saída proposta: calcular uma vez as séries com dois ou mais professores (agrupar por `serie_id`, `having count(distinct …) >= 2`) e juntar, em vez de uma subconsulta por linha; medir de novo com o mesmo volume e anotar. É mudança de `governanca.repository.ts` (A5), com `infra-guardian` (regra 80, item 8) e `tenancy-guardian`; antes do piloto, não da X2. Quem reescrever o grupo mínimo leva junto dois testes de integração em `governanca.int.test.ts`: um que prove que a série de um professor só continua fora da lista e dentro dos números (hoje só o e2e `Registros › IA: a série com um professor só` a prova, e reescrever a regra sem teste de integração seria regressão da D45), e um com `?estado=rejeitada` e dado (o e2e só exercita "Rejeitados" vazio).
- [ ] **O apoio de "Rejeitado" diz que o professor recusou "com justificativa", mas a linha chega sem o motivo (telas da coordenação, 10.0; conformidade-reviewer, 1ª rodada).** O texto de apoio do número "Rejeitado" (`textos-da-governanca.ts`) promete a justificativa, e a linha da tabela rejeitada vem da A5 com `motivo: ''`. Na próxima tarefa que tocar os `textos-*.ts`, dizer que a justificativa está na auditoria, ou tirar a promessa; os textos de hoje não mudaram na 10.0.
- [ ] **Registros › IA a 1366 px: a coluna "Decisão" fica estreita e "ESPERANDO O PROFESSOR" quebra em três linhas (telas da coordenação, 10.0; frontend-reviewer, 1ª rodada).** Com o consumo ao lado a partir de 1024 px, a tabela de `Governanca.tsx` divide a largura com os 18 rem do consumo. Duas saídas do revisor: largura mínima para a coluna "Decisão" (`COLUNAS`), ou o consumo ao lado só a partir de 1280 px (`lg:` para `xl:`). Mexe numa largura que o e2e de 1366 × 768 mede, e o revisor disse que fica legível: o `/validar` decide.
- [ ] **A espera da resposta atrasada, em `e2e/governanca.spec.ts` e em `Governanca.test.tsx` (telas da coordenação, 10.0; revisor-geral e test-engineer, 2ª rodada).** No e2e `a resposta do filtro antigo, que chega depois…`: tirar os ouvintes de `requestfinished` e `requestfailed` com `page.off(...)` dentro de `aoTerminar`, depois do `resolver()`; e, como `requestfinished` chega antes de a página processar a resposta, esperar um quadro (`requestAnimationFrame`) ou voltar a "Aprovados" e ver as linhas antigas no cache antes de conferir "Esperando o professor" (hoje o risco é falso verde, nunca falso vermelho, e a chave por estado está provada no componente). Em `Governanca.test.tsx`, no caso da resposta atrasada, sobrou um `setTimeout(resolver, 50)` com a mesma corrida: esperar a chamada da rede falsa ser resolvida. Na próxima tarefa que tocar esses arquivos; mexer agora caduca `test-engineer` e `revisor-geral`.
- [ ] **Painel: as duas listas rolam por dentro do miolo, e o teclado para duas vezes (correção 2026-10-17-painel-e-pedido-rolam-a-pagina; frontend-reviewer, 1ª e 2ª rodada).** Dentro do miolo do Painel (`O_MIOLO_SEM_ABAS_QUE_ROLA`), `Lista` ainda tem `tabIndex 0` e `max-h` com rolagem própria (`Painel.tsx`), então com a janela baixa há rolagem dentro de rolagem. Reavaliar no `/retro` da X2 se as listas deixam de limitar a própria altura. Muda desenho e comportamento da tela.
- [ ] **Detalhe do pedido de titular: só o estado mais curto é medido (correção 2026-10-17-painel-e-pedido-rolam-a-pagina; test-engineer, 1ª e 2ª rodada).** `paginaNaoRola` mede o pedido "recebido", sem arquivo e sem compartilhamento. Falta uma fixture de pedido no estado longo (arquivo pronto e compartilhamento preenchido) e um caso que prove que o miolo segura a tela no pior caso. Fixture nova em `e2e/__fixtures__/`.
- [ ] **A vitrine não tem pedido de titular, e a Mesa não vê a foto do detalhe do pedido (correção 2026-10-17-painel-e-pedido-rolam-a-pagina; frontend-reviewer, 2ª rodada).** Pôr um pedido registrado na escola cheia da vitrine (`tools/vitrine/`) para as próximas rodadas fotografarem `/coordenacao/privacidade/pedidos/<id>`, com e sem a faixa de incidente. Tarefa própria.
- [ ] **Painel: o texto "O Painel não lê, porque cada leitura fica na auditoria" é denso (correção 2026-10-17-painel-e-pedido-rolam-a-pagina; frontend-reviewer, 2ª rodada).** Está correto, mas pesado para a coordenadora; encurtar na próxima tarefa que tocar o Painel ou os `textos-*.ts`. Texto de tela, fora da correção de altura.
- [ ] **`Professores.tsx:183`: o ramo `professores.isError ?` com a lista ainda vazia não tem teste (correção 2026-10-17-vazio-durante-a-leitura; test-engineer, 1ª rodada).** A releitura que falha logo depois do primeiro cadastro mostra o erro e não "Nenhum professor ainda". Pede caso novo em `Professores.test.tsx` com a mutação do ramo; é anterior ao C4 da validação da X2.
- [ ] **O título do cartão "Incidente de segurança…" corta com reticências a 360 px (`componentes/ui/Linha.tsx:58`; correção 2026-10-17-vazio-durante-a-leitura; frontend-reviewer, 1ª rodada).** O `truncate` deixa o título inteiro só no `title`. A correção dos achados C1 a C3 da validação da X2 não o tratou, e a validação (rodada 2) viu o mesmo corte a 1366 px, no sino e na fila do Painel ("Professora Sintética Marta 3f5476e2 cont…", "O material \"Apostila de validação que fal…"): o que o item pede some com nome longo. Saída: deixar o título do item quebrar em duas linhas no sino e no Painel. Destino: a próxima tarefa que tocar `componentes/ui/Linha.tsx` ou o Painel, ou a X3, que reusa o sino.
- [ ] **Menores da validação da X2 (`tasks/prd-telas-da-coordenacao/validacao.md`, rodadas 1 e 2, 17/10/2026), sem tela nem regra mudando.** Testes: (a) `SinoDaCoordenacao.test.tsx:152-156` lê `antes` depois do clique e a asserção passa sempre (ler antes do clique; a regra está provada por `Sino.test.tsx:75`); (b) `fila-da-coordenacao.test.ts:111` é tautológico (fixar `TIPOS_DA_FILA` com `toEqual` dos cinco); (c) nenhum teste exclui busca ou filtro por pessoa em Registros › IA (D45, D64): no `Governanca.test.tsx`, zero `searchbox` e `textbox`, como o `Analista.test.tsx:221`; (d) `e2e/__fixtures__/verificacoes.ts:98`: `larguraExcedenteDoDialogo` mede só o `dialog[open]` de cima, e o painel de baixo deixa de ser medido com diálogo por cima. Documentos: (e) RF19 e Tech Spec §9 dão a entender que retomar um agente pede confirmação, e o código retoma direto (`Agentes.tsx:142-145`; o PRD só exige confirmar a suspensão); (f) Tech Spec §9 "Chromebook e celular" (`techspec.md:127`) ainda fala em teto de linhas com "Mostrar mais" em Material, Pedidos e IA; (g) Tech Spec §7c não registra o `retryOnMount: false` (`fila-da-coordenacao.ts:190`) da correção `2026-10-16-tentar-de-novo-da-estrutura-no-celular`; (h) Tech Spec §10 diz que o e2e `governanca` prova "no servidor" os números com o filtro, e ele prova a tela; (i) Prazos de guarda não têm vazio (`privacidade/Retencao.tsx:28`): registrar na Tech Spec que não se aplica; (j) `7_task.md` não registra que as asserções da antiga seção Alocação foram para a unidade (`o-que-falta-para-alocar.test.ts:15`, `o-que-falta-da-escola.test.ts:40`); (k) mutações antigas de `1_task.md` (`...SEM_LEITURA_SOZINHA`) e `3_task.md` (`O_MIOLO_QUE_ROLA` em `moldura.tsx`) não aplicam mais: para o `/retro`. (dono: Joaquim)
- [ ] **(X2, validação) Para o Joaquim saber, sem correção pedida:** (a) o detalhe de um pedido do titular passou de 2 cliques (Privacidade › linha) para 3 (Registros › Pedidos › linha), porque Registros abre em IA; do Painel, pela porta "Pedidos dos titulares", continua a 2; (b) a 360 px as abas de Escola quebram em duas linhas (Turmas e Professores numa, Material na outra): legível, sem esconder aba, mas difere do mockup; (c) a 1366 × 768 com a faixa de incidente, "Esperando você" no Painel fica com 144 px e mostra dois itens e meio (ver também a linha "Painel: as duas listas rolam por dentro do miolo"). (dono: Joaquim)
- [ ] **(X2, recomendações sem destino) Três que as correções deixaram para depois:** (a) uma linha de texto "O painel abre depois do aviso" quando o aviso de incidente segura o painel aberto pelo endereço (`frontend-reviewer`, correção `2026-10-17-painel-pelo-endereco-cobre-o-aviso`; muda texto de tela, decisão de produto); (b) o texto do incidente da vitrine e da fixture ("Segunda linha do texto.") pouco realista para demonstração (`frontend-reviewer`, correção `2026-10-17-troca-de-escola-sem-ir-para-a-entrada`); (c) o sino da coordenação faz seis leituras a cada recarga de página (1.0; `techspec.md:96` tem a conta da manhã de segunda): medir com a escola do piloto e, se pesar, juntar numa leitura só. (dono: Joaquim)
- [ ] **A vitrine não entra como operador (validação da X2, rodada 2).** As fotos de `/operacao` e `/operacao/uso` vieram de um Playwright fora do repositório, com as fixtures `criarOperadorComSegundoFator` e `semearPainel`. Levar à ferramenta da vitrine (`tools/vitrine/`) um modo operador, junto do que a 14.0 já registrou. (dono: Joaquim)
- [ ] **`PRAZO_DA_ENTRADA_MS = 20_000` está escrito em quatro arquivos de e2e (correção 2026-10-19-mfa-codigo-de-recuperacao-estoura-o-prazo; revisor-geral, 1ª rodada).** Em `e2e/mfa.spec.ts`, `e2e/__fixtures__/segundo-fator.ts`, `e2e/__fixtures__/casca.ts` e `e2e/__fixtures__/tela-da-operacao.ts`. Exportar de uma fixture só e importar nos outros evita que os valores se separem. É limpeza que toca arquivos fora da correção; fazer numa tarefa que já altere esses e2e. (dono: Joaquim)
- [ ] **Em "Turmas", o painel de contestação fecha sozinho e o texto some quando o vínculo sai da lista por fora** (`revisor-geral`, 9.0 da X3, 1ª rodada). Se o vínculo é decidido em outra aba ou pela coordenação enquanto a professora escreve, `doPainel` fica `undefined` e o painel desmonta sem avisar. Vale limpar o estado e dizer que o vínculo mudou, e garantir que o rascunho do complemento não fique no estado do cliente nem seja reenviado ao reabrir o painel de outro vínculo (`privacy-guardian`, 2ª rodada); muda comportamento da tela (`apps/web/src/areas/professor/turmas/Turmas.tsx` e `PainelDaContestacao.tsx`): correção própria
- [ ] **O ajudante que entra pela API e abre o endereço está copiado em cinco specs** (`revisor-geral`, 9.0 da X3, 1ª rodada): `abrirJaEntrando` em `escola-e-vinculos`, `inatividade`, `professor-turmas` e `acesso-da-turma`, e `entrarPelaApi` em `areas`. Mover para `e2e/__fixtures__/` é refatoração de cinco specs, com risco para os casos que ela não altera
- [ ] **Turmas 9.0: recomendações de forma** (`test-engineer` 2ª, `revisor-geral` 2ª, `frontend-reviewer` 2ª): bloco de mutação de `contestar.reset()`; axe da variante com e-mail do login por cima (ver se `acesso-suspenso.spec.ts` ou `professores.spec.ts` a cobrem); ids UUID v7 no teste da cor (`familia-da-disciplina.test.ts`); `?? 0` no teste de quebra da faixa (`professor-turmas.spec.ts`); comentário duplicado antes de `decidindo` (`Turmas.tsx`); respiro no fim do miolo do painel a 360 px
- [ ] **A vitrine fotografa a aba da turma antes de ela carregar** (`frontend-reviewer`, correção encontro-10, 1ª rodada). A foto de Atividades e Alunos no computador pode sair em "Carregando a aba…": esperar o fim do carregamento em `tools/vitrine/` antes de fotografar. (dono: Joaquim)
- [x] **"1 de 1 aluno enviaram" concorda mal no singular** (`frontend-reviewer`, correção encontro-10, 1ª rodada; `apps/web/src/areas/professor/aprovar.ts:131`). Texto de tela: para a tarefa que tocar `aprovar.ts`. (dono: Joaquim) **Feito na 11.0**: "1 de 1 aluno enviou".
- [ ] **Aba Hoje: "Nenhum aluno acertou menos da metade…" repete em toda habilidade** (`frontend-reviewer`, correção encontro-10, 1ª rodada). Dizer uma vez só na seção, na tarefa que tocar a aba Hoje. (dono: Joaquim)
- [ ] **Título de atividade cortado a 360 px na `Linha`** (`frontend-reviewer`, 11.0 da X3, 1ª rodada): com vários títulos parecidos, avaliar duas linhas de título no celular. É comportamento da `Linha` da X1; o texto inteiro está no `title` e no painel.
- [ ] **A aba Alunos conta um só botão cheio só no vazio dos pedidos** (`test-engineer`, correção alunos-dois-botoes-cheios, 1ª rodada). Um caso com dois pedidos e o acesso ativo fecharia o resto da aba (com pedidos entra o botão oficial, grafite): caso novo com fixtures de pedido, na tarefa que tocar `AlunosDaTurma.test.tsx`. (dono: Joaquim)
- [ ] **Faixa "Esperando você" cheia pode esmagar a conversa a 1366 × 768 (correção 2026-10-19-formulario-e-assistente-rolam-a-pagina; `frontend-reviewer` e `revisor-geral`, 1ª rodada; `test-engineer`, 2ª).** Com a faixa aberta (muitas pendências) e "O que cada função faz sozinha" aberto, o `max-h` do painel de `Time.tsx` pode chegar perto de zero e a conversa some. As duas saídas propostas se contradizem (teto de altura com rolagem própria na lista da faixa mantém a página parada; altura mínima do painel a faz rolar de novo), e é decisão de desenho. Com o `md:top-0` fora, a página que voltar a rolar a partir de 768 px deixaria a faixa presa 56 px abaixo do alto, sem barra em cima: é o mesmo defeito de fundo. Junto, dois e2e que a correção não cobriu: "Ver" da faixa com a rolagem dentro do painel (`scrollIntoView` e o `scroll-mt-48` do cartão, pensado para a página) e `paginaNaoRola` no formulário depois de gerar sem preencher e com o resultado no cartão. O Orquestrador decide se abre a correção.
- [ ] **`useTopoDoMiolo` e `useTopoDoPainel` repetem o efeito de medir (`miolo-do-documento.ts`; correção 2026-10-19-formulario-e-assistente-rolam-a-pagina; `revisor-geral`, 1ª rodada).** Dá para tirar um ajudante comum que recebe o elemento a medir. Fica para a próxima tarefa que tocar o arquivo, porque mexer em `useTopoDoPainel` (do documento do professor, 6.0) obriga a refazer os blocos de mutação dele e os desta correção, que apontam para o texto atual.
- [x] *feito em 19/10/2026, na retrospectiva da X3: o parágrafo diz as três telas e os hooks de cada uma.* **Tech Spec de telas-do-professor: a seção "(8) A página não rola, rola a mesa" (`techspec.md:211-213`) só fala do documento** (`revisor-geral`, 1ª rodada, mesma correção). Hoje o miolo é também o do formulário de ferramenta e o de "O que o Assistente fez". É do Arquiteto: o Orquestrador repassa no fechamento da spec.
- [ ] **Menores da mesma correção (`frontend-reviewer` e `test-engineer`, 2ª rodada), sem comportamento mudando.** (a) `Ferramenta.test.tsx:177-179`: o `Reflect.deleteProperty(globalThis, 'ResizeObserver')` do `finally` sobra, porque o `vi.unstubAllGlobals()` de `prepararTela` já desfaz o `vi.stubGlobal`; tirar na próxima tarefa que tocar o arquivo. (b) Adaptação a 1366 × 768: a borda de baixo do cartão fica cortada em y≈727 com o miolo no topo, e o `md:pb-1` dá só 4 px de respiro; um respiro maior ou uma sombra de rolagem é decisão de desenho. (c) A 360 px o placeholder do campo "Tema" da atividade objetiva sai truncado ("…reagente limitar"): um exemplo mais curto, para quem tocar o formulário da atividade objetiva.
- [ ] **A turma que sai do alcance deixa os nomes no cache de consultas** (`privacy-guardian`, correção hoje-vinculo-encerrado, 1ª rodada; `Turma.tsx`, `perderATurma`): a página some com o aviso, mas as leituras da turma (sinais, uso do Tutor, lista de alunos) ficam no cache até a sessão acabar. Vale também para a aba Alunos: `removeQueries` das leituras da turma ao perdê-la. Antes, conferir se a rota remonta `Turma` ao trocar de `turmaId`, porque `perdida` é estado que só zera na remontagem (`frontend-reviewer`, mesma rodada). O teste que ler o cache (`tudoDoCache`) entra com a tarefa que fizer o `removeQueries` (`test-engineer`, 2ª rodada). Duas menores de teste, para quem tocar `TurmaHoje.test.tsx` e `Turma.test.tsx` (`test-engineer`, 2ª rodada): (a) provar o "uma vez só" esperando `errorUpdateCount === 2` da consulta dos sinais, e não só a 3ª chamada ao `fetch`; (b) com o painel fechado, `not.toContain('Caio Sintético')` é vazio: tirar "sem o nome de aluno nenhum" do título desse ramo, ou comentar que só as abas e o aviso o provam. (dono: Joaquim)
- [ ] **(X3, validação) A vitrine não abre Aprovar: a semente de validação grava um resumo que o esquema recusa (`e2e/__fixtures__/governanca.ts:147`; validação da X3, rodadas 1 e 2, M1 e N5).** O registro sintético grava `resumo: { alunos: 1, enviadas: 1 }`, que o `esquemaLoteApresentado` estrito (`packages/shared/src/atividade/correcao.ts:75`) recusa: `GET /v1/atividades-aplicadas/:id/correcao` responde 500 (`ZodError` em `correcao.service.ts`) e Revisar a correção fica em "Carregando a correção…" na vitrine (`tools/vitrine/escola.ts:7` usa a fixture). Por isso a medida de rolagem de Aprovar não conta nas duas rodadas. Anterior à spec. Correção própria: o resumo no formato do esquema. (dono: Joaquim)
- [ ] **(X3, validação e 10.0) Hoje: o nome do aluno chega ao navegador antes do "Ver quem", e o "sem nome" é provado só no texto (validação da X3, rodada 1, M4 e M2; `privacy-guardian`, `frontend-reviewer` e `conformidade-reviewer`, 10.0, 1ª e 2ª rodadas).** (a) Hoje lê `GET /v1/turmas/:id/desempenho`, que traz `alunos[].nome`, com o painel fechado (`gcTime: 0`, nada na tela), e os sinais trazem o aluno de cada sinal: separar na API o agregado do nominal (dívida para o F6; a Tech Spec §7 aceita os nomes em memória com `gcTime: 0`). (b) A atenção humana é contada só na primeira página de sinais (`TurmaHoje.tsx:75-77`): a API devolveria a contagem à parte (muda contrato em `packages/shared`). (c) Os testes de "sem nome" (`TurmaHoje.test.tsx:226`, `e2e/professor-tutor.spec.ts:86`) leem só o texto: um nome num `aria-label` passaria; conferir também os atributos. (dono: Joaquim)
- [ ] **(X3, 10.0) O aviso de atenção humana da aba Hoje, que se projeta em sala, mostra a hora exata e "precisa de um adulto", e um aviso antigo fica no alto sem limite de data (`conformidade-reviewer`, `privacy-guardian` e `revisor-geral`, 1ª rodada; `frontend-reviewer` e `privacy-guardian`, 2ª).** Versão discreta na aba projetada, ou aviso que se recolhe. Pergunta ao Arquiteto na próxima revisão da Tech Spec (§7b) e ao Joaquim antes do piloto; é desenho da Tech Spec, e o dado é sintético (D71). (dono: Joaquim)
- [ ] **(X3, 10.0) Piso de agrupamento na aba projetada (`frontend-reviewer` e `privacy-guardian`, 1ª rodada).** "1 aluno pediu a resposta pronta…" nos sinais e a contagem pequena do acerto por habilidade identificam o aluno na tela projetada. Entra na decisão dos indicadores e dos limiares, antes do PRD do F6 (`CLAUDE.md`, decisões em aberto). (dono: Joaquim e Gabriel)
- [ ] **(X3, 12.0) Aba Alunos: a releitura que falha depois de decidir um pedido deixa a tabela velha na tela, sem aviso (`AlunosDaTurma.tsx`, o erro da lista só aparece com `!listaLida`, `:115`; `revisor-geral`, 1ª rodada; validação da X3, M2).** Muda comportamento e texto de tela: dizer que a lista pode estar desatualizada, com "Tentar de novo". Correção própria, com teste. (dono: Joaquim)
- [ ] **(X3, 13.0) "Convidar alunos": o passo "Gerar novo acesso" não volta a "Gerar acesso" quando outra pessoa revoga (`ConvidarAlunos.tsx`; `revisor-geral`, 1ª rodada; validação da X3, M2).** Só o passo "Vigente" volta. Muda comportamento e pede teste novo: correção própria. (dono: Joaquim)
- [ ] **(X3, 5.0) Criados: falha na leitura dos vínculos passa calada, e o vazio dos filtros cita os três (`revisor-geral` e `frontend-reviewer`, 1ª e 2ª rodadas).** (a) Com os vínculos em erro, todo grupo vira "Outra turma" sem aviso (`Criados.tsx:158`; o vazio de `:196` só cobre a espera). (b) "Nenhum documento seu tem este tipo, nesta turma e neste estado." (`Criados.tsx:190`) cita os três filtros mesmo com um só ligado. Muda comportamento, texto e os testes que o citam. (dono: Joaquim)
- [ ] **(X3, 6.0) O documento aberto (`Artefato.tsx`): o que a 6.0 deixou para quem recompor a tela (`frontend-reviewer`, 1ª e 2ª rodadas; validação da X3, rodada 1, M8 e RF13).** (a) "Artefato" na tela: título e vazio (`Artefato.tsx:107`, `:130-134`) e "Abrir o artefato" (`ResultadoDaFerramenta.tsx:47`); o glossário diz "documento", e e2e citam o texto. (b) "Voltar para Criados" volta sem os filtros que estavam (mockup 10.2). (c) A 360 px, três ações empilhadas: agrupar as raras no "⋯" (X3 ou F7). (d) De 768 a 1023 px: respiros menores e a miniatura abaixo do enunciado até `lg`; a faixa nunca foi fotografada. (e) Na versão adaptada pendente a 1366 × 768 a mesa começa em ~575 px e sobra ~150 px de folha: juntar as duas frases do cabeçalho, levar "Abrir a atividade de origem" à linha do "Voltar", e altura mínima do painel no e2e. (f) Na aba "Na turma", "Pedir versão adaptada" (laranja) e "Aplicar à turma" (grafite) são duas ações cheias à vista: decidir se a R4 de `docs/interface.md` admite um laranja e um grafite na mesma tela. (dono: Joaquim e Gabriel)
- [ ] **(X3, 2.0 e 1.0) "O que o Assistente fez" e o sino: nomes e marca (`frontend-reviewer`, 1ª rodada das duas).** (a) Os nomes do pé do sino ("O que o Assistente fez", "O que o Tutor viu") não batem com o `h1` e o título da aba ("Assistente de ensino", `Time.tsx:181`; "Tutor"): muda título de tela e de aba, que a Tech Spec §9 fixa. (b) Os itens "Correção para revisar" e "Versão adaptada para decidir" (`fila-do-professor.ts:107`, `:113`) não dizem que vieram do Assistente: uma marca curta no `detalhe` ou no rótulo do grupo (regra 70, item 4a). Muda texto de tela e a forma do item: decisão do Arquiteto. (dono: Joaquim e Gabriel)
- [ ] **(X3, 1.0) O teste de carga não conta as leituras do sino do professor (`infra-guardian`, 1ª rodada).** Incluir no cenário as até 14 leituras por professora que abre a casca: a conta de cerca de 28 por minuto contra o limite de 120 só existe no papel. Mudança no teste de carga de infra. Ver também a letra (c) da linha "(D80, revisão das specs X2 a X4)". (dono: Joaquim)
- [ ] **(X3, 14.0 e validação) Vocabulário (RF21): a lista proibida está em dois lugares, e sete telas não têm teste (`privacy-guardian` e `revisor-geral`, 14.0, 1ª rodada; validação da X3, rodada 1, M3).** (a) Juntar `VOCABULARIO_PROIBIDO` (`e2e/professor-aprovar.spec.ts:19` e `aprovar.test.ts`) com `VOCABULARIO_DE_NOTA` (`e2e/__fixtures__/professor/cena.ts:17`, repetido em `e2e/a3-a4-professor.spec.ts:19` e `e2e/roteiro-da-demonstracao.spec.ts:63`) num lugar só, na tarefa que alterar `cena.ts` (mais três specs a importam). (b) Criados, Turmas, Início, Conversa, o documento, Convidar e o sino não têm teste de vocabulário. (c) O regex `\bmédia\b` não pega "Acerto médio" (`aprovar.ts:236`): ver "Para o Joaquim saber" abaixo. (dono: Joaquim)
- [ ] **(X3, `tools/ci/duracao-do-e2e.ts`) Retitular um caso de e2e o faz parecer novo para o HEAD (diário do Orquestrador; vizinha da letra (a) do item "(X1, retrospectiva) Código de processo").** A régua acha o prazo declarado no HEAD pelo título do caso; com o título trocado, não acha e cobra 15 s. Hoje isso trava renomear casos lentos: o `a3-a4` leva 64 s e o `lugares` 28–31 s, e é por isso que os títulos com "Seu time" ficaram (validação da X3, N4, na linha dos menores abaixo). Correção própria em `tools/ci/duracao-do-e2e.ts`, com teste e bloco de mutação. (dono: Joaquim) **Entra no código de processo da retrospectiva da X3, logo abaixo (M3).**
- [ ] **(X3, retrospectiva) Código de processo que a X3 pediu** (`tasks/prd-telas-do-professor/retro.md`, M1 a M3). **Destino que o
      Joaquim deu em 19/10/2026: antes da primeira tarefa da X4**; **em 23/10/2026, a X7 (`harness`)**, que vem antes da X4, junto
      da P4 e das M1 a M7 da X5, com teste e revisão; mexe em `tools/processo/` e `tools/ci/`: (M1) **censo de prazo do e2e**: `tools/processo/esteira.ts` ganha um comando que lê o log do e2e da última execução
      verde da spec e lista os casos acima de dois terços do próprio prazo (o declarado, que `duracao-do-e2e.ts` já sabe ler; 20 s nos que
      não declaram), e o Orquestrador, ao fechar cada tarefa, abre uma correção para a lista que não estiver vazia, antes de o caso ficar
      vermelho. Seis dos oito vermelhos da esteira da X3 foram prazo de caso que a tarefa não tocou (areas:204, mfa:85,
      escola-e-vinculos:423, acesso-suspenso:165, pecas-sobrepor:556, privacidade:142), e o privacidade:142 já levava 27 a 29,6 s nas
      execuções verdes; o item "(X3, a vigiar)" acima é a lista feita à mão. (M2) `tools/processo/linhas.ts conferir` compara com a base
      da branch (a spec, na `correcao/` saída dela), e não sempre com a `develop` (diário do Orquestrador, 19/10). (M3) o item da régua
      com o caso retitulado, logo acima. (dono: Orquestrador)
- [ ] **(X3, a vigiar) Casos de e2e acima de 15 s na máquina, que esta spec não tocou (correção `2026-10-19-acesso-suspenso-passa-do-prazo`, "Fora desta correção"; diário do Orquestrador).** `e2e/areas.spec.ts:231` (19–21 s; 23,8 s na esteira), `acesso-suspenso.spec.ts:78` (18,4 s), `escola-e-vinculos.spec.ts:212` (22,4 s) e `:272` (18,9 s). Se a esteira estourar, correção como a do `acesso-suspenso:165` e a do `areas:204` (correções `2026-10-19-acesso-suspenso-passa-do-prazo` e `2026-10-18-professor-em-area-alheia-estoura-o-prazo`): entrada pela API e primeira carga sem a rede lenta. (dono: Joaquim)
- [ ] **(X3) A vitrine não semeia nem fotografa o que as telas do professor pedem (`conformidade-reviewer` e `frontend-reviewer`, 10.0, 1ª e 2ª rodadas; `frontend-reviewer`, 12.0, 1ª; `frontend-reviewer`, correção `2026-10-19-sino-cem-ou-mais`; `privacy-guardian`, `infra-guardian` e `revisor-geral`, 1.0, 1ª e 2ª).** Em `tools/vitrine/`: (a) a escola cheia sem sinal de atenção humana, sem dois sinais por aluno e sem sinal de trabalho antigo: o aviso, a ordem de nome, a linha nominal e o texto novo de Hoje nunca foram vistos em foto; (b) a aba Alunos com a lista vazia e com "Saiu da turma"; (c) mais de 100 entregas, para fotografar a pílula "100+" a 360 px; (d) a vitrine clica na largura do computador e só depois encolhe a tela, então a foto do celular sai com a lista do sino fechada: clicar já na largura da foto (a lista fecha quando a largura cruza 768 px, ver "Sino da coordenação, três pontos", item 3). (dono: Joaquim)
- [ ] **(X3, testes) Menores de teste das tarefas e correções da X3, sem tela nem regra mudando.** Cada um na próxima tarefa que tocar o arquivo: (a) `pedidos.test.ts:302`: o nome diz "uma releitura só", mas a asserção `toHaveLength(2)` conta também a leitura inicial; e um comentário dizendo que o caso protege a deduplicação do TanStack Query, que nenhuma linha nossa deixa vermelha (1.0, `revisor-geral` e `test-engineer`, 3ª); (b) `Criados.test.tsx:285` e `:328`: a espera fixa de 50 ms pode deixar o caso verde com a mutação em máquina carregada; esperar um sinal de que a resposta chegou (5.0, `test-engineer`, 2ª); (c) caso de componente com dois cliques em "Aplicar à turma" no mesmo `act`, como o do encerrar (6.0, `test-engineer`, 1ª); (d) Hoje: segunda pessoa na mesma aba sem nenhum nome da primeira no cache nem na tela; o mesmo aluno repetido com o painel aberto, com o mesmo número no aviso e no painel; e a asserção do e2e da turma de outra escola estendida ao `/desempenho` (10.0, `test-engineer` 1ª e 2ª, `tenancy-guardian` 2ª); (e) aba Alunos: a passagem do `signal` (`api/alunos-da-turma.ts:28-31`) sem teste que dependa dela, e o nome e o comentário do caso "resposta atrasada" (`e2e/professor-turma-alunos.spec.ts:176`, `:200-201`) prometem o que o caso não prova; `if (porNome !== 0) return porNome` sem bloco; aluno com vínculo encerrado ou `desativadoEm` sumindo da aba; professor de duas disciplinas na mesma turma com uma lista só; trocar de escola com a aba Alunos aberta (`e2e/troca-de-escola.spec.ts`) (12.0, `test-engineer`, `tenancy-guardian` e `revisor-geral`, 1ª e 2ª); (f) `e2e/convidar-alunos.spec.ts:101-103`: `expect(gravacoes).toEqual([])` passa por construção (o POST só sai com clique): contar qualquer pedido a `/v1/turmas/<id>/acesso`, ou tirar a asserção e o "nem pede o acesso" do título; e o caso da turma inexistente saiu do arquivo (regra 10, item 6) (13.0, `test-engineer`, 2ª); (g) `SinoDoProfessor.test.tsx`: cenário com pedidos de nome e turma a confirmar junto das 100 entregas, mostrando o piso somado ("102 ou mais") (correção `2026-10-19-sino-cem-ou-mais`, `test-engineer`, 1ª); (h) `aprovar.test.ts` só resolve `@educa/shared` rodando da raiz: é do ambiente de teste (2.0, `test-engineer`, 1ª). (dono: Joaquim)
- [ ] **(X3, comentários e documentos) Menores de texto da X3, sem comportamento mudando.** Comentários: (a) `fila-do-professor.ts:306-307` diz que "Atualizar" relê cada leitura por `refetchQueries`; as contagens são relidas por `fetchQuery`, em série (1.0, `revisor-geral`, 2ª); (b) o `enabled` decidido por `cliente.getQueryState` na renderização (`fila-do-professor.ts:333`) depende de o `useQueries` renderizar de novo: uma linha dizendo isso, e um comentário em `main.tsx` apontando que o `resetQueries` depende dele (1.0, `revisor-geral` e `tenancy-guardian`, 2ª); (c) `pedidos.ts`, `invalidarAContagem` (`:128-140`): a releitura depois de uma decisão sai fora da série e da parada por limite; dizer isso no comentário (1.0, `privacy-guardian`, 2ª); (d) `Painel.tsx:20` importa `SEM_LEITURA_SOZINHA` pela reexportação de `fila-da-coordenacao.ts:15`: importar direto de `componentes/sino/leitura-do-sino.ts` e tirar a reexportação (1.0, `revisor-geral`, 1ª); (e) `AcessoDaTurma.tsx:17` e `AlunosDaTurma.tsx:31-32` ainda dizem "abre sozinho, uma vez por pedido": o comportamento é abrir na montagem da aba enquanto o endereço pedir (13.0, `revisor-geral`, 2ª); (f) `Criados.test.tsx` e o e2e do recomeço: comentário de que quem prova o `resetQueries` de `main.tsx` é o e2e, e de que o caso depende do `staleTime` de 30 s (`cliente-de-consultas.ts:25`) (5.0, `test-engineer`, 2ª). Documentos: (g) Tech Spec da X3 §5: a exceção das duas chaves da navegação sem `gcTime: 0` (`estrutura/turma/<id>`, `acesso-da-turma/<id>`) está no teste do sino e não na Tech Spec (12.0, `revisor-geral`, 1ª e 2ª; Arquiteto); (h) Tech Spec da X3 §9, item 5: completar a lista de testes fora dos previstos com `AlunosDaTurma.test.tsx`, `Turmas.test.tsx` e `dialogo-aberto.test.ts` (13.0, `revisor-geral`, 2ª); (i) `tasks.md:52-53`: as subtarefas 7.1 e 7.2 estão `[ ]` com a 7.0 `[x]` (validação, M6); (j) títulos de e2e que ainda dizem "Seu time" como lugar: `e2e/professor-lugares.spec.ts:19` (de propósito, comentário em `:16`), `e2e/a3-a4-professor.spec.ts:22`, os `describe` de `e2e/professor-entregas.spec.ts:15` e `:231`, e `e2e/pecas-marca-onca.spec.ts:92`; as asserções provam que nenhuma tela diz "Seu time", e renomear espera a linha do `duracao-do-e2e.ts` acima (validação, M5 e N4); (k) `docs/roteiro-da-demonstracao.md:229` escreve o título entre aspas curvas (“Atividade — Reagente limitante”) e a tela usa aspas retas (`sinais.ts:28`; o resto do documento usa retas) (correção `2026-10-19-docs-sem-seu-time`, `revisor-geral` e `conformidade-reviewer`, 2ª); (l) `docs/aia/sinais-e-alertas.md:387`: "lido uma vez, ao abrir" não é exato, porque a consulta relê quando a janela volta ao foco (`staleTime` de 30 s e `refetchOnWindowFocus` padrão, `cliente-de-consultas.ts:22-26`): "lido ao abrir o painel, sem releitura periódica" (mesma correção e rodada). (dono: Joaquim)
- [ ] **(X3, recomendações de tela sem destino) Acabamentos que as tarefas e correções deixaram, cada um para a tarefa que tocar a peça.** (a) Barra de baixo a 360 px corta "FERRAMEN…" (`componentes/BarraDeBaixo.tsx`): reduzir o `tracking` ou a caixa-alta do rótulo (5.0, `frontend-reviewer`, 1ª e 2ª; a validação, rodada 1, o dá como já escrito, e não está); (b) o botão de enviar vazio (cinza) da `CaixaPedido` tem pouco contraste com o fundo (3.0, `frontend-reviewer`, 1ª); (c) `Artefato.tsx:269-270`: o `<span>Gabarito</span>` visível e o `rotulo="Gabarito"` do `Interruptor` repetem o texto no mesmo `<label>`, e o leitor de tela pode anunciar o nome duas vezes; conferir se o `Interruptor` já esconde um dos dois (correção `2026-10-19-a2-assistente-conta-um-gabarito-a-mais`, `frontend-reviewer`, 1ª; validação, M2); (d) o sino: os pedidos de nome dizem "ou mais" no texto (`oQueConta`, `fila-do-professor.ts`) e a pílula do item não leva o `ouMais`; passar `item.haMais` ao `Contador` muda a pílula de "100" para "100+" (correção `2026-10-19-sino-cem-ou-mais`, `revisor-geral`, 1ª); (e) "Convidar alunos" (`ConvidarAlunos.tsx`): o título "Gerar acesso" acima do subtítulo "Acesso gerado" repete a ideia; a 1366 × 768, na tela inteira, o bloco fica colado ao topo; `TEXTO_DE_QUEM_VE_A_LISTA` é longo no celular; e a linha "Vale até …" do passo "Vigente" sai com a moldura azul de foco e parece campo (`useFocoDaEtapa`, `copia-unica.tsx`): rever junto do mockup 6 (13.0, `frontend-reviewer`, 1ª e 2ª); (f) a `Tabela` da aba Alunos não virtualiza e acumula até 100 por página com "Ver mais": medir com CPU limitada quando houver turma de 100 ou mais (12.0, `frontend-reviewer`, 1ª); (g) com a letra Maior a barra de baixo (68 px fixos, `componentes/BarraDeBaixo.tsx:79,88` e `estilos.css:324`) fica apertada; nada é cortado e o e2e a 360 px com Maior passa, mas rever a altura junto do item (a) (telas do aluno, 8.0, `frontend-reviewer`, 1ª); (h) no diálogo "Ajustes" do aluno, o título "Aparência" (rótulo do `Segmentado` da `Aparencia`, da X1) e o "Tamanho da letra" (`legend` do `fieldset`) não se alinham: alinhar quando a `Aparencia` for tocada (8.0, `frontend-reviewer`, 1ª). (dono: Joaquim e Gabriel)
- [ ] **(X3, validação) Para o Joaquim saber, sem correção pedida:** (a) "Acerto médio" (`aprovar.ts:236`) é média de acertos com outra palavra; está registrado na Tech Spec §9 (RF21) e fica para o Joaquim confirmar se é vocabulário aceito (validação, rodadas 1 e 2, M3; 10.0, divergência 2); (b) o "e2e por tipo" do RF3 está em 2 de 4: pedidos e versão adaptada por e2e, correção aprovada e turma confirmada por componente com a tela que decide ao lado, provados por mutação (rodada 2, RF3); (c) a 360 px a página das telas do professor rola inteira, sem rolagem lateral: é o "funciona a 360 px" do RF22, e só a 1366 × 768 o miolo rola por dentro (rodada 2, RF22); (d) o lado a lado de cada foto com a seção do `mockup.md` é a métrica do PRD §9, que o Gabriel aprova ou aponta (rodada 2, seção 2); (e) com oito fatias de e2e (X4, 26/10/2026) o teto é de cerca de 1576 casos, com uns 190 de margem; antes eram sete fatias e cerca de 1379 (`tools/ci/prazo-do-e2e.ts`; correção `2026-10-19-setima-fatia-do-e2e`; diário do Orquestrador). (dono: Joaquim)

## Da X5 (reengenharia), fora dela

- **O `TESTE` da `guarda:camadas` libera das cercas qualquer `src/**/__fixtures__/` e `src/**/test/`** (X5, 12.0,
  `tenancy-guardian`): hoje existem `apps/web/src/__fixtures__`, `apps/web/src/operacao/__fixtures__` e
  `packages/nucleo/src/ia/__fixtures__`, e um arquivo de produção posto numa pasta com esse nome passa pelas três cercas. Restringir o
  padrão de `tools/guardas/camadas.cjs` a `*.test.ts`, `*.spec.ts`, `apps/*/test/`, `e2e/` e `__fixtures__/` fora de `src/`, ou deixar
  escrito por que não; a varredura por nome (linha abaixo) tem o mesmo furo. Muda o que o lint acusa no código de hoje (as `__fixtures__` de `src/` precisam de nome de teste)
- **A varredura por nome das classes cercadas** (X5, 12.0, `arquitetura.test.ts › o nome das classes cercadas…`, recomendações da 2ª rodada):
  (a) não vê alias, `export { PainelRepository as Leitor }` numa ponte de dentro da zona: reprovar `export` do nome da classe, e
  `export *` do arquivo dela, em arquivo da zona que não seja o da classe nem um barril permitido; (b) o primeiro `it` não exige
  arquivo lido em `tools/` nem em `infra/`: exigir ao menos um em cada pasta, com mutação que tire `tools` da lista; (c) não lê
  `.cjs` nem `.cts`; (d) o `deTeste` do arquivo não reconhece `*.spec.ts` nem `*.test.tsx`, e o `TESTE` do `camadas.cjs` sim, e
  `src/**/test/` e `src/**/__fixtures__/` ficam de fora dos dois (mesma pendência da linha do `TESTE`, acima); (e) a tabela de
  testes da `12_task.md` não tem linha para o `real: todo alvo de regra existe no grafo…` nem para esse `describe`, e três
  blocos de mutação se repetem (o que tira `tools` do comando quebra o caminho da configuração, em vez de tirar só `tools`)
- **A rodada real do `guarda:camadas` exclui só `__fixtures__/camadas/`** (X5, 12.0, `test-engineer`): as fixtures da 9.0 e
  `tools/ci/fixtures/` entram no grafo real. Excluir todo `__fixtures__/` e `tools/ci/fixtures/` do `exclude` de
  `tools/guardas/camadas.cjs`, ou registrar a escolha. A 13.0 acrescenta fixture em `tools/guardas/__fixtures__/` e mexe no mesmo
  `exclude`: decidir lá
- **A vitrine não tem pedido com arquivo pronto em "Meus dados"** (correção `2026-10-22-intermitentes-desafio-e-meus-dados`,
  `frontend-reviewer`): as fotos de `tools/vitrine/` não mostram o botão "Baixar meus dados" nem o diálogo. Acrescentar o
  pedido pronto e o diálogo aberto à vitrine na próxima tarefa que mexer em `tools/vitrine/`
- **Prova fixa da ordem em que o `focoDeReserva` do diálogo de "Meus dados" vale** (correção
  `2026-10-22-intermitentes-desafio-e-meus-dados`, `test-engineer`): um caso que espere "Arquivo apagado" na lista antes de
  tocar em "Fechar" (a releitura chegando antes de "Fechar"), para provar o `useDialogoModal` com a reserva. Pede um ajudante
  novo em `e2e/meus-dados.spec.ts` e não cabia na correção; o `useDialogoModal` não foi alterado

- **Leitura humana do corpus `ouro`** (`docs/aia/ouro/`), escrito por modelo na X5: o Joaquim ou o Gabriel leem uma vez
  antes do piloto, no portão da primeira escola real, porque uma medida feita contra um corpus fraco engana (R40)
- **O que o Tutor faz com ameaça a terceiro** ("vou levar a arma do meu pai pra escola", "vou matar todo mundo kkk"):
  a D36 cobre o risco à própria vida, com o CVV, e a ameaça a outra pessoa não tem mensagem nem caminho decididos. O
  `ouro` mede a categoria `ameaca_a_terceiro` sem alvo, só com o piso de não cair da base de hoje. Decidir com o `conformidade-reviewer` e advogado, junto de
  dois casos do mesmo tipo: se revelar orientação sexual ou identidade de gênero gera o sinal ao professor (risco de
  expor o aluno), e o que acontece quando o professor da turma é o próprio agressor, porque é a ele que o sinal chega.
  Antes de aluno real
- **A saída do Tutor sob a D55:** hoje só o Assistente do professor passa pela conferência de saída da D55. Se o aluno
  colar a própria redação no Tutor e pedir opinião, só o prompt segura. Decidir com o `conformidade-reviewer`, medindo o
  falso positivo ("você errou 3 questões") no `ouro` (R40). Prazo: antes de aluno real, junto do portão da primeira
  escola; até lá a limitação fica escrita em `docs/aia/tutor.md`
- **O bucket do staging sem versionamento** (X5, 45.0): o PDF temporário do material sai do storage em até 25 h
  (`docs/lgpd.md`), e um bucket com versionamento guarda o objeto apagado como versão antiga. Ao criar o staging (D42),
  conferir; se o provedor exigir versionamento, uma regra de ciclo de vida expira as versões antigas em até 24 h
- **A frase do `onda-0.md` §2.4 (linha 94) diz que a pergunta pausada fica "no registro que o professor vê"** (X5, 4.0): o
  código a deixa fora da supervisão (`supervisao.repository.ts`), só em `mensagem_tutor`, fora da contagem e da última troca.
  Corrigir o texto para "fica só em `mensagem_tutor`, fora da contagem e da última troca" quando a spec for tocada de novo.
  O comentário "A pergunta continua no registro que o professor vê" no caso da primeira janela de `tutor.int.test.ts` repete a
  mesma frase: corrigir os dois juntos, para "fica só em `mensagem_tutor`, sem resposta"
- **O risco que sobra da avaliação aberta antes do `entrada()`** (X5, 4.0): a pergunta delicada que o filtro de frases não
  reconhece, e que só o modelo classificaria, é pausada sem a mensagem fixa. A spec aceita o caso; registrar em
  `docs/aia/tutor.md`, ao fechar a onda 0, junto com a medida que o Arquiteto escreve (`onda-0.md` §4)
- **`TUTOR_PAUSADO_EM_AVALIACAO` fora da contagem de falha de execução** (X5, 4.0): a pausa por avaliação aberta termina
  como `falhou`; quando a 47.0 e a 49.0 criarem `job.falhos{tipo}` e o alerta "Provedor de IA fora", essa falha não pode
  contar como falha do provedor
- **`execucaoLida`, `pausada` e `consumoDaExecucao` repetidos** em `tutor.int.test.ts` e `tutor-modelo.int.test.ts` (X5,
  4.0): levar para `apps/api/test/escola-com-tutor.ts` na próxima tarefa que mexer nesse arquivo, porque mexer nele caduca
  todos os testes de Tutor que o usam
- **As limitações conhecidas do `riscoAVida`, para `docs/aia/tutor.md`** (X5, 2.0): ao fechar a onda 0, junto com a medida
  do lote retido (`onda-0.md` §2.1 e §4). (a) O sinal `atencao_humana` sai com o nome do aluno que escreveu, também quando o
  risco é de outra pessoa ("meu irmão quer se matar"); (b) a AIA do Tutor diz que o sinal nunca aparece como histórico por
  aluno (regra 70, item 7); (c) dispara de propósito, por erra-para-mais (decisões 4 e 7 do `ouro`): "o Romeu queria morrer
  junto da Julieta?", "não quero mais viver na cidade grande", "meu time joga melhor sem mim", "o professor quer me matar com
  essa lista" (o mesmo jeito de "meu padrasto quer me matar"), e "dose letal" ou "queda fatal" numa aula de ciências;
  (d) a exclusão do padrão de altura vale para a frase inteira: "ovo", "objeto", "experimento", "bola" ou "queda livre" em
  qualquer lugar dela impedem o disparo, mesmo que "altura" e "queda" falem de uma pessoa; prender a exclusão ao sujeito da
  queda é o ajuste, e fica para depois da medida do lote retido
- **O risco à vida medido com o modelo de produção** (X5, 94.0; `onda-0.md` §2.2a): a `indireta` e o
  `risco_de_outra_pessoa` são medidos com o padrão ou o modelo, no Ollama. Repetir a medida com o provedor que a D37
  escolher, com `tools/ia/medir-risco-a-vida.ts` sobre um lote retido novo, antes de a F5 ficar pronta
- **As falhas do modelo na medida do risco à vida** (X5, 94.0, recomendação do `llm-integrator`): o relatório de
  `tools/ia/medir-risco-a-vida.ts` imprime só o total de chamadas que falharam. Imprimir também `falhas / (execuções ×
  amostras)`, para o Arquiteto saber se o modelo local falhou por JSON ruim ou por prazo antes de ler a taxa. Pedir só se
  a medida do lote retido 2 mostrar falhas; o relatório tem teste próprio, que muda junto
- **Os pisos do lote retido 2 e o que fazer abaixo de 0,80** (X5, 94.0, recomendação do `conformidade-reviewer`): antes da
  primeira escola real, registrar na limitação de `docs/aia/tutor.md` o resultado do lote retido 2 sobre `tristeza_sem_risco`,
  `homonimo` e `conteudo_escolar`, e definir o que acontece se a precisão ficar abaixo de 0,80. Uma opção é suspender só a soma
  do modelo. Depende da medida do lote retido 2, que é do Arquiteto
- **O tipo `SaidaDoTutor` aceita `risco_a_vida`** (X5, 94.0, recomendação do `revisor-geral`): o tipo vem de
  `z.infer<typeof esquemaSaidaDoTutor>`, e o serviço o importa (`tutor.service.ts`), então pelo compilador a saída da tarefa
  aceita `risco_a_vida`; o comportamento é garantido em execução pelos testes (`ajustar` a troca por `assunto_delicado`).
  Separar o tipo da saída crua do modelo do tipo do que a tarefa devolve fecharia isso na compilação, e toca o serviço
- **A ameaça de outra pessoa e a ameaça a terceiro** (X5, 2.0): "meu padrasto quer me matar", "ele disse que vai me matar" e
  "vou matar ele" recebem hoje a mensagem do CVV e o sinal `atencao_humana`, porque a 2.0 não mudou a resposta;
  "o professor quer me matar com essa lista" dispara pelo mesmo jeito de dizer, e "os meninos vão me matar na saída" (a ameaça
  direta, sem verbo que a conte) não dispara, porque "vão me matar" é a forma da expressão ("a prova vai me matar"). A decisão
  de produto é mandar a ameaça de outra pessoa ao `assuntoDelicado`, e não ao 188, e decidir o caso da ameaça direta; decidir
  junto da linha acima sobre ameaça a terceiro, com o `conformidade-reviewer` e advogado, antes de aluno real
- **A trava de tenant, `tools/guardas/escopo-dos-repositories.ts`, e o teste dela** (X5, 6.0): na próxima tarefa que mexer num dos
  dois arquivos, (a) tratar no analisador `export { f }`, `export default f`, o parâmetro desestruturado e o alias de tipo local,
  que o cabeçalho hoje declara como limites, com uma fixture e uma mutação para cada; (b) acertar a frase do cabeçalho "nenhum
  existe hoje no código", que o primeiro limite contradiz (a função de `homonimo.ts` existe, e só passa sem acusação porque
  `titulares.homonimo` está na lista); (c) renomear, em `repositories-com-escopo.test.ts`, o caso "cada entrada diz o motivo com
  pelo menos 30 caracteres", que diz 30 por extenso enquanto o corpo usa `TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO`, e os blocos
  de mutação que o citam
- **Os pedidos sem corpo, tipados pelo `shared`** (X5, 14.0, recomendação do `revisor-geral`): o `professores.controller.ts` declara
  `_corpo: Record<string, never>` e monta o esquema com `.default({})` localmente, e a "armadilha" da tarefa manda declarar o tipo
  com o de `@educa/shared`. Exportar `PedidoSemCorpoDoConviteDeProfessor` (e o esquema com `.default({})`) de
  `packages/shared/src/professores/professores.ts`, e trocar o controller, quando alguma tarefa mexer em contrato compartilhado
  (a 15.0 e a 16.0 repetem o mesmo corpo vazio em `sala` e `operacao`): é contrato compartilhado, que a 14.0 não toca
- **A cláusula de escola de `TurmaRepository.aberta` sem bloco de mutação** (X5, 15.0, recomendações do `tenancy-guardian`, do
  `revisor-geral` e do `test-engineer`): o caso `estrutura-isolamento.int.test.ts › a turma de um ano encerrado de B, lida pela
  coordenação de A com o anoLetivoId de B…` fica vermelho sem `eq(turma.escolaId, exigirEscolaDoContexto())`
  (`turma.repository.ts:193`), conferido à mão na 15.0, mas nenhum bloco de "Mutações" o declara, porque a cláusula não é
  nova da tarefa e mexer no repository caducaria os três revisores. Declarar o bloco na tarefa que tocar `turma.repository.ts`.
  Na mesma tarefa: dizer no comentário de `#doAnoDaLeitura` (`:177-178`, "o ano precisa ser da escola do contexto") que isso
  só vale por causa da linha 193, e que a subconsulta do ano não protege sozinha; e, no caso de isolamento, comparar as
  respostas entre si (`expect(resposta).toEqual(respostas[0])`), como o caso vizinho faz, e não só com `mensagem: expect.any(String)`

- [ ] **(X5, 51.0) Duas páginas na mesma atividade, no e2e:** a 51.0 provou em unidade e em tela o aviso "Sua resposta foi alterada em outra janela" e a regra de só a mais nova valer; falta um caso de e2e com duas páginas do mesmo navegador na mesma atividade, nos projetos `chromebook` e `celular`. Entra na 53.0 (o espelho em `sessionStorage`, que fecha a outra aba e o F5) (`frontend-reviewer` e `test-engineer`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) Atividade em andamento na semente da vitrine:** `tools/vitrine/` só tem atividades já feitas, e o aviso de outra janela exige uma em andamento aberta em duas janelas; semear uma para a IA e a pessoa verem a tela (`frontend-reviewer`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) Contrato na janela do deploy:** web nova com API antiga (o `strictObject` da API antiga recusa a chave `sequencia` com `ENTRADA_INVALIDA`) e aba antiga com API nova (o `PUT` sem `sequencia` é o cliente antigo e continua valendo). Escrever em `docs/runbook.md` a ordem de deploy (API primeiro, depois a web) na primeira tarefa que mexer nele (`infra-guardian`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) `.max()` em `esquemaSequencia`:** a `sequencia` aceita qualquer inteiro não negativo até o limite do `bigint`; declarar um teto muda o contrato do `shared` e o corpo recusado. Decisão do Arquiteto (`infra-guardian`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) Cenário de carga da prova em `infra/k6/`:** o `PUT` de resposta com `sequencia` (escola inteira respondendo ao mesmo tempo, com reenvio) cabe junto da 52.0 e da 53.0, com o adaptador falso e sem provedor pago (`infra-guardian`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) Dizer nos fixtures que o `PUT` sem `sequencia` é o cliente antigo:** `apps/api/test/atividade-de-teste.ts` e `e2e/__fixtures__/aluno-pela-api.ts` mandam a resposta sem `sequencia`, e quem lê não sabe que isso é o caminho do cliente antigo (`infra-guardian`, 51.0, 1ª rodada).
- [ ] **(X5, 51.0) `arquivo-do-titular.int.test.ts` com data fixa:** três a quatro casos de data e de validade vencem desde 19/10/2026 e deixam a esteira vermelha, com e sem a 51.0 (verificado revertendo `leitura-do-titular.ts`). Corrigir (data relativa ao relógio do teste) **antes do pouso**, fora da 51.0 (`revisor-geral`, 51.0, 1ª rodada).
- [ ] **(X5, 7.0) `rotinaDoSistema` sem escola, em unidade:** falta um caso de unidade com `rotinaDoSistema: true` e sem escola em `packages/nucleo/src/contexto/contexto.test.ts`; hoje só `apps/despachante/test/vagas.int.test.ts` (a `daEscola`) segura a regra de que a rotina não ganha leitura sem escopo (`test-engineer`, 7.0, 1ª rodada).
- [ ] **(X5, 7.0) Mutação por método do `ConviteRepository`:** `usuarioConvidado`, `criarConvite`, `travarEscola`, `dadosDaCoordenacao` e `dadosDoProfessor` só trocaram a cópia por `exigirEscolaDoContexto`, e a presença da chamada é provada pela guarda; falta um caso de teste e uma mutação por método (`revisor-geral` e `test-engineer`, 7.0, 1ª rodada).
- [ ] **(X5, 7.0) Cópia local fora de repository:** `packages/nucleo/src/configuracao/configuracao-operacional.ts:165` ainda checa a escola do contexto com a mensagem própria `'configuração operacional sem escola no contexto'`; trocar por `exigirEscolaDoContexto` quando alguma tarefa tocar o arquivo (`revisor-geral`, 7.0, 1ª rodada).
- [ ] **(X5, 53.0) Dado sintético com atividade "para responder" na vitrine:** `tools/vitrine/` não tem atividade aberta com respostas ainda não salvas, e o estado "não salva" e o "Tentar de novo" não são fotografados a 360 px (`frontend-reviewer`, 53.0, 1ª rodada).
- [ ] **(X5, 53.0) `aoAbrirSessao(tentarTodas)` sem a variação do recuo:** a fila manda na hora em que a sessão volta, sem o jitter de `esperaAntesDeTentar`; só pesa se a sessão passar a voltar sozinha de muitas abas ao mesmo tempo, o que hoje não existe (`infra-guardian`, 53.0, 1ª rodada).
- [ ] **(X5, 53.0) Acabamentos do espelho:** (1) o comentário de `apps/web/src/api/sessao.ts:76-78` ainda aponta para `areas/aluno/espelho-da-fila.ts` e diz só "sai no 'Sair'": citar `api/espelho-da-fila.ts`, a suspensão e a troca de dono feita pela casca; (2) a limpeza no "Sair" só vale porque a `CascaDaEscola` é importada direto, sem `lazy`: importar o espelho em `main.tsx` (ou registrar o gancho por função chamada ali) e acrescentar em `CascaDaEscola.test.tsx` o caso que clica em "Sair" e confere o `sessionStorage` vazio sem a Atividade carregada; (3) `api/espelho-da-fila.ts` importa o tipo `EscolhaPendente` de `areas/aluno/respostas`: derivar de `EspelhoDaFila['pendentes'][number]` (ou mover para `packages/shared`); (4) caso que fixe que a troca de escola da mesma pessoa apaga as pendentes da escola anterior (`revisor-geral` e `test-engineer`, 53.0, 2ª rodada).
- [ ] **(X5, 8.0) `onda-1a.md` acima do teto:** o arquivo tem cerca de 2.700 palavras e o teto da `techspec.md` é 1.500 (já passava, com 2.442 no HEAD); enxugar ou partir na próxima tarefa da onda 1a que o tocar (`revisor-geral`, 8.0, 1ª rodada).
- [ ] **(X5, 8.0) Fixture no `dist` do núcleo:** `packages/nucleo/tsconfig.build.json` só exclui `src/**/*.test.ts`, então `ia/__fixtures__/contexto-da-escola.ts` (e os outros `__fixtures__`) vão para o `dist`; acrescentar `src/**/__fixtures__/**` ao `exclude` (`revisor-geral`, 8.0, 1ª rodada).
- [ ] **A guarda de chave pessoal olha só o primeiro nível do esquema** (X5, 18.0; `tools/guardas/definicoes-de-job.test.ts`,
  `chavesPessoaisDe` lê `esquema.shape`): descer recursivamente na tarefa da onda 3 que trouxer o primeiro payload de job com
  objeto ou lista de objetos, porque `{ aluno: { nome } }` hoje passaria (`privacy-guardian`, 18.0, 1ª rodada)
- [ ] **O 500 de `PedidoDeJobRecusado` sem teste HTTP** (X5, 18.0): a recusa é defeito de quem enfileirou e responde 500 pelo
  filtro geral de erro, que não leva `message` nem `stack`; falta o caso de integração que fixe isso para este erro. Escrever na
  próxima tarefa que mexer no filtro de erro (`privacy-guardian`, 18.0, 1ª rodada)
- [ ] **O `Enfileirador` grava `lidos.data`, e nenhum esquema tem `default` nem `transform`** (X5, 18.0): quando o primeiro esquema
  de `DEFINICOES_DE_JOB` ganhar um, acrescentar o caso que distingue gravar o dado lido do payload original, com a mutação
  `dados: dados` no lugar de `dados: lidos.data` em `enfileirador.ts` (`test-engineer`, 18.0, 1ª rodada)
- [ ] **(X5, 97.0) Dois comentários de e2e citam `api/` velha:** `e2e/acesso-da-turma.spec.ts:415` (`api/acesso.ts`, hoje
  `areas/professor/turmas/api/acesso.ts`) e `e2e/professores.spec.ts:309` (`api/professores.ts`, hoje
  `areas/coordenacao/professores/api/professores.ts`). Tocar os dois faria o portão rodar os e2e deles por uma citação de
  comentário: fica para a tarefa que mexer neles (`revisor-geral`, 97.0, 1ª rodada)
- [ ] **(X5, 97.0) Os dois testes do build de `apps/web/nome-dos-chunks.test.ts` (`describe` "o build de verdade da web", dos
  casos B2 e "as áreas da escola") usam o prazo padrão de 5000 ms** e estouraram com a máquina cheia, antes e depois da
  tarefa: prazo explícito no `it` na próxima tarefa que tocar o arquivo (`test-engineer`, 97.0, 1ª rodada)
- [ ] **(X5, 9.0) Helper de teste que não termina em `.test.ts` e importa tabela do núcleo:** a guarda `tabela-so-no-repository`
  usa `ARQUIVOS_DE_TESTE` (`**/*.test.{ts,tsx}`, `e2e/**/*.spec.ts`) como exceção, então um helper em `apps/api/test/` ou
  `e2e/__fixtures__/` que importe tabela seria reprovado. Hoje nenhum importa. Fixar o lado, com um caso para cada um, muda o
  que as outras guardas de teste enxergam: decidir quando o primeiro helper precisar (`test-engineer`, 9.0, 1ª rodada)
- [ ] **(X5, 48.0) O meio-aberto fecha o disjuntor com o provedor ainda fora:** no `AdaptadorResiliente`, a chamada de teste que sai como `ChamadaCancelada`, 429 ou outro 4xx conta como sucesso e fecha o disjuntor, mesmo sem prova de que o provedor voltou. Muda comportamento: pede teste e linha em "Divergências"; a dona do disjuntor é a 49.0 (`infra-guardian`, 48.0, 1ª rodada).
- [ ] **(X5, 48.0) Cenário de carga « provedor recusando por limite no meio da aula »:** falta em `infra/test/carga.test.ts` o caso com o adaptador falso devolvendo 429 enquanto a escola usa o Tutor; cabe na 47.0 ou na 49.0 (`infra-guardian`, 48.0, 1ª rodada).
- [ ] **(X5, 44.0) O alerta "Job que falhou de vez" fica aceso 30 dias, e falha nova do mesmo tipo não avisa de novo:** `job_falhos > 0`
  é contagem de linhas (a Tech Spec pede a série assim) e só esvazia pelo expurgo ou, no `titular.*`, pela ação do operador. Com a 46.0
  (X6) dar o comando que esvazia a série, ou trocar por contador `job.falhou_total{tipo}` no worker com `increase(...) > 0`
  (`infra-guardian` e `revisor-geral`, 44.0, 1ª rodada)
- [ ] **(X5, 44.0) Duração do lote do expurgo com muitos `falhou` que ficam:** cada lote relê e descarta no começo do índice os `falhou`
  de `titular.*` e os de 7 a 30 dias; medir o lote depois de uma pane em massa, ou ter caso de carga com milhares deles
  (`infra-guardian`, `revisor-geral` e `test-engineer`, 44.0, 1ª rodada)
- [ ] **(X5, 44.0) Nenhum teste liga a linha `falhou` do executor à medição e ao expurgo:** `execucao.int.test.ts › falha permanente…`
  e os testes da 44.0 semeiam por SQL; um executor que gravasse `falhou` sem `concluido_em` passaria. Teste novo entre `apps/worker` e o
  expurgo (`test-engineer`, 44.0, 1ª rodada)
- [ ] **(X5, 44.0) Helper comum para capturar a instrução e rodar o `EXPLAIN`:** o caso de carga de `job.falhos` troca o `pool.query` à
  mão, como o dos pendentes em `apps/despachante/test/metricas-espera.int.test.ts` (`revisor-geral`, 44.0, 1ª rodada)
- [ ] **(X5, 44.0) Teto para o `falhou` de `titular.*`:** a linha fica até a ação do operador; registrar um teto que siga o
  `pedido_titular` (contrato mais 5 anos), para ela não durar mais que o pedido (`privacy-guardian`, 44.0, 1ª rodada)
- [ ] **(X5, 46.0) O descarte de linha `titular.*` precisa de auditoria com autor e finalidade:** ainda não existe `46_task.md` para
  receber a nota (`privacy-guardian`, 44.0, 1ª rodada)
- [ ] **(X5, 43.0) Retenção do tipo de job de IA em lote:** conferir, ao fazer o prazo por tipo, se a retenção é coerente com o limite
  de passos e de custo (`llm-integrator`, 44.0, 1ª rodada)
- [ ] **(X5, 43.0) Prazo próprio para o `interromper()` no desligamento:** `montagem.ts` espera `await executor.interromper()` sem corrida de uns
  3 s como a do `close()`; com banco ou Redis de vagas lentos, a gravação e a liberação consomem a folga entre os 20 s da graça e os
  25 s do `stop_grace_period`. Muda o comportamento do desligamento (`infra-guardian`, 43.0, 1ª rodada)
- [ ] **(X5, 43.0) Processador real que escuta o `sinal`:** `montar-arquivo`, `expurgar-*` e `eliminar-titular` não conferem
  `sinal.aborted` entre um lote e outro, então o corte do prazo e o aborto do desligamento não os param (R55, decisão 2, aceita isso e o
  runbook avisa). Entra na tarefa que mexer em cada um (`infra-guardian`, 43.0, 1ª rodada)
- [ ] **(X5, 43.0) `threadsMaximo` ultrapassado por milissegundos no aborto:** dizer no comentário de `infra/compose.carga.yml`, junto do
  `cpus:` fixo, que a thread terminada pelo aborto deixa de ser contada antes de morrer (`infra-guardian`, 43.0, 1ª rodada)
- [ ] **(X5, 43.0) Caso de concorrência D49 com processador real:** a retentativa depois de `TEMPO_ESGOTADO` roda ao mesmo tempo que o
  processador antigo que ignorou o `sinal`; precisa de um processador que grave efeito com a chave de idempotência, e hoje só o sintético
  existe (`test-engineer`, 43.0, 1ª rodada)
- [ ] **(X5, 43.0) Conferir o retorno de `concluir` no log:** no caminho de sucesso do `executor.ts`, `job.concluido` sai mesmo quando `concluir`
  devolve `false` (a linha já terminou, por exemplo `falhou/EXECUCAO_INTERROMPIDA` de um processador que ignora o `sinal`); escrever só
  quando devolver `true` (`infra-guardian` e `revisor-geral`, 43.0, 2ª rodada)
- [ ] **(X5, 43.0) Limite de 4 s do caso com `attempts: 3`:** `prazo-do-job.int.test.ts › o estouro com tentativa sobrando também libera a
  vaga da escola` tem uns 0,8 s de folga no pior caminho; a asserção que prova a regra é a da ordem. Se ficar instável na esteira, a
  correção abre com a medição (`test-engineer`, 43.0, 2ª rodada)
- [ ] **(X5, 12.0) A regra do depcruise cobre o que os `it` provisórios da 10.0 olham:** o `it` de `ConferenciaDoAutor` trata de nome de
  tipo e não de caminho de import, e `IMPORTA_A_OPERACAO` não pega import só de efeito (`import '../operacao/x.js'`) nem aspas duplas;
  a 12.0 substitui esses `it` e decide o que fica (`revisor-geral` e `test-engineer`, 10.0, 2ª rodada)
- [ ] **(X5, 12.0) A regra do depcruise cobre o que os `it` provisórios da 11.0 olham:** a regex `/\blogin\.service\.js['"]/` de
  `arquitetura.test.ts` casaria `outro-login.service.js` e não pega import sem extensão, e a varredura de `login.service.test.ts` não
  pega `export default <nome>` nem `export = <nome>`; a 12.0 substitui esses `it` e decide o que fica (`test-engineer`, 11.0, 1ª e 2ª rodadas)
- [ ] **(X5, 17.0) Alinhar o `.trim()` do `slug`:** só o da query do login externo é cortado, o do caminho de `/v1/escolas/:slug/acesso` não; mudar o segundo muda a rota `/e/:slug`, para quando a tela for revista (`tenancy-guardian`, 16.0, 1ª rodada)
- [ ] **(X5, 17.0) Um `esquemaSemCorpo` só:** exportar `esquemaPedidoSemCorpoDeOperador.default({})` de `packages/shared` no lugar das três cópias (`painel.controller.ts`, `operacao/sessao/sessao.controller.ts` e o `revogar` de `sala/acesso-da-turma/acesso-da-turma.controller.ts`, da 15.0) (`revisor-geral`, 16.0, 1ª rodada)
- [ ] **(X5, 17.0) O segundo bloco do ESLint lista só quem usa o `@Req()`:** hoje vale em `sessao` e `operacao` inteiros (divergência 6 da 16.0) e deixa a porta aberta em quatro controllers que não o usam; a 17.0 generaliza o primeiro bloco e decide a lista (`infra-guardian`, 16.0, 1ª rodada)
- [ ] **(X5) O `describe('ops:redefinir-mfa')` de `mfa.int.test.ts` cria o próprio operador:** hoje depende de o `operador-teste` existir, defeito anterior à 16.0 (`infra-guardian`, 16.0, 1ª rodada)
- [ ] **(X5, 17.0) Contagem exata das marcas de `requisicao.body|query|params` em `guardas.test.ts`:** o `toEqual(esperadas)` vem da própria fixture, e apagar as três marcas de `daRequisicao` o deixa verde; a 17.0 generaliza o primeiro bloco e mexe nesse teste (`revisor-geral`, 16.0, 2ª rodada)
- [ ] **(X5, 17.0) Dois jeitos de montar o corpo vazio que pode faltar** (`revisor-geral`, junto do "Um `esquemaSemCorpo` só" acima): a constante local `esquemaSemCorpo = X.default({})`
  em `professores.controller.ts`, `operacao/sessao/sessao.controller.ts`, `operacao/painel/painel.controller.ts` e `sala/acesso-da-turma/acesso-da-turma.controller.ts`,
  e o `esquemaPedidoSemCorpoOuAusente` de `packages/shared` (atividade). Unificar na próxima tarefa que mexa nesses controllers;
  quatro arquivos de outros módulos não cabiam na 17.0
- [ ] **(X5, 34.0) O `sessao/index.ts` exporta o que só os testes de `apps/api/test` usam** (`tenancy-guardian`): `ConviteRepository`, `ContaExternaRepository`, `CookieOidc`, `CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA` e `ESCOLA_DESCONHECIDA`. A 34.3 manda o índice trazer o que `apps/api/{src,test}` usam, e é assim que está. A regra do `dependency-cruiser` da 12.0 pode barrar o uso desses fora de `apps/api/test`, ou os testes passam a importar pelo arquivo
- [ ] **(X5, 34.0) Três restos de texto e de reexport depois da `sessao/index.ts`** (`test-engineer` e `revisor-geral`, 2ª rodada): (1) o comentário de `apps/api/test/arquitetura.test.ts` (conferência do índice) ainda cita `export * from './tenant/index.js'`, arquivo que não existe; (2) `renovacao/renovacao.service.ts` reexporta `JANELA_DE_RENOVACAO_SIMULTANEA_MS` só para `renovacao.service.test.ts`: importar de `@educa/shared` no teste e apagar o reexport, na tarefa que mexer em `renovacao.service.ts`; (3) `tasks/prd-reengenharia/34_task.md`, tabela de testes, diz "as mutações 1 a 5", e com o bloco de aspas duplas são seis
- [ ] **(X5, 96.0) A mensagem do teste do repositório em `tools/guardas/tamanho-das-pastas.test.ts` fala só da web** ("telas, hooks e cliente de API dele"): trocar por uma que sirva às duas raízes ("divida por assunto ou por recurso (D81)"). Na próxima tarefa que tocar o arquivo (`test-engineer`, 96.0, 2ª rodada)
- [ ] **(X5, fora dela pelo diagnóstico) O que a Etapa 5 deixou fora da X5** (`tasks/prd-reengenharia/DIAGNOSTICO.md` §6,
  com o achado de cada um em `tasks/prd-reengenharia/diagnostico/`). Cada um destrava com a decisão ou a fase que está ao lado:
  (a) o corte do teto de IA da escola fora do Tutor (bloquear, avisar, cair de modelo), U03-6: com a decisão em aberto
  "Valores das faixas de preço e teto de IA" (D14, D39); (b) o Analista sem modelo onde a regra já calcula, U03-12: mexe na
  D32, por `/descobrir`; (c) "abrir a atividade sem responder" contar como aberta, U05-15: regra de produto, no PRD do F6;
  (d) gatilho de auditoria no banco para a transição de `entrega.estado`, U05-3: migration em tabela da regra 70, no F16;
  (e) a imagem de produção da web (Caddy ou borda), U10-9: com o staging (D42); (f) a janela de deploy contra a faixa dos
  expurgos, U06: com o primeiro deploy em produção (D31); (g) backup, restauração e rollback, U10-17: no portão do piloto
  (S13 de `tasks/prd-reengenharia/RISCOS.md`); (h) a rodada do despachante em lote no Redis, U06-8: depois de ~10 escolas
  (D25), medindo antes; (i) a telemetria de falha do navegador, U07-8: canal novo de dado a partir de tela de menor, com o
  `privacy-guardian` e a linha em `docs/lgpd.md` (a X5 deixou só a porta `reportarFalha`, sem envio). (dono: Joaquim)
- [ ] **(X5, 95.0) Seis precisões do guia e da arquitetura** (`revisor-geral`, rodada sobre o `c88231a`, APROVADO; a lista
  com linha está em "Recomendações sem aplicar" de `tasks/prd-reengenharia/95_task.md`): `credencial/` também guarda
  repositories da sessão; a exceção do `operacao/token-do-convite.ts` ao "só pelo `index.ts`"; as regras de camada que não
  valem para teste; as cercas que a linha do dependency-cruiser não cita; o exemplo `estrutura/turma/` sem os testes ao
  lado; e o `erro-tipado` sem `packages/shared/src`. Na X6, quando a Etapa 11 reescrever a documentação. (dono: Joaquim)
- [ ] **(X5, relatório final) `vite` 8.3.0 com alta no `npm audit`, e `vitest` 5.0.0 com moderada** (`tasks/prd-reengenharia/relatorio-final.md`
  §2): correção sem versão maior, em 8.3.5 e 5.0.5. A trava (`guarda:dependencias`) olha só produção, e por isso não
  acusa; mas a imagem `web` roda `vite preview` (`tasks/prd-reengenharia/medidas-da-onda-5.md`). Subir antes do staging,
  numa correção com o portão. (dono: Joaquim)
- [x] **(X5, validação 1) O encontro das linhas rodar o `eslint .` depois do merge** (X7, `harness`; é a M2 da X5): a supressão órfã de
  `tools/ci/compose.ts` nasceu de duas tarefas verdes, cada uma no seu portão (13.0 e 90.0), e só a validação a viu.
  (dono: Joaquim) — *feito na X7, tarefa 6.0 (`8dce7e7`): o encontro roda tipagem e lint e recusa o vermelho.*
- [x] **(X5, RF31) `.dockerignore` e `tools/ci/dockerfile.test.ts:128-130` ainda citam `.reengenharia`**, a pasta que o
  fechamento da X5 apagou (R64). A linha não faz mal (ignora uma pasta que não existe), e tirá-la é código, com o teste junto:
  na próxima tarefa que tocar o Dockerfile ou o `.dockerignore` (onda 5, na X6). (dono: Joaquim) — *resolvido na correção
  `2026-10-24-dockerignore-reengenharia` (ensaio do RF31 da X7): a linha saiu do `.dockerignore`, e o teste passou a exigir que
  `.reengenharia` não esteja lá.*
- [ ] **(X7, correção `2026-10-24-dockerignore-reengenharia`) Revisar a lista de pastas ignoradas do `.dockerignore`**, trocando a
  proibição de um nome que já não existe (`.reengenharia`) por uma checagem do que importa: o contexto de build não deve levar
  pasta de processo nem de documento (`infra-guardian`, 1ª). Na mesma revisão: a asserção de ausência deixa passar o curinga
  (`**/.reengenharia`, `.reengenharia/**`), e `ignorados.some((l) => l.includes('.reengenharia'))` igual a `false` fecha isso
  (`test-engineer`, 2ª); e a normalização de `tools/ci/dockerfile.test.ts` só cobre a barra do começo ou do fim, de modo que
  `mockups/**` faria o teste acusar falta, o que erra para o lado seguro (`revisor-geral`, 2ª). Momento: na próxima tarefa que
  tocar o Dockerfile ou o `.dockerignore`. (dono: Joaquim)
- [ ] **(X5, correção `porta-unica-so-import`) `arquivosDeCodigo` só deixa de fora o `.test.ts`** (`privacy-guardian`, 1ª
  rodada): em `apps/api/src/operacao/escola/escola.repository.test.ts`, um `.test.tsx` ou `.spec.ts` que citasse o módulo seria
  acusado como código. Alinhar com o filtro das outras guardas, e conferir os três testes que usam a função, na próxima tarefa que
  mexer nela (`tasks/correcoes/2026-10-22-porta-unica-so-import.md`, linhas 110 e 115). (dono: Joaquim)
- [x] **(X5, esteira) `e2e/casca.spec.ts:67` [celular] passa do prazo do dado, e dois e2e do `celular` caíram uma vez na `develop`.**
      O caso "com dado: versão e componentes… em até 5 s" mede o tempo até o dado na tela contra `PRAZO_DO_DADO_MS = 5_000`
      (`casca.spec.ts:10`, asserção em `:73`) e caiu duas vezes na esteira: 5117 ms em `d6eb2f0` (`39896375281`, spec da X5,
      commit só de documento) e 5018 ms na `develop`, no pouso `5566974` (`39907941527`); antes, 151 ms acima em `a0f1974`. Não é
      código da X5: o mesmo código passou nas execuções vizinhas. Na mesma execução da `develop` caíram uma vez cada, e passaram
      na reexecução, `e2e/areas.spec.ts:647` (a guarda sem o `/v1/eu`) e `e2e/troca-de-escola.spec.ts:156` (W13, o seletor), os
      dois no `celular`. **A correção do `casca` parte depois da retrospectiva da X5** (`tasks/prd-reengenharia/retro.md`),
      como `/corrigir` própria; os outros dois entram nela se caírem de novo, ou no censo de prazo do e2e (item "(X3,
      retrospectiva) Código de processo", M1). (dono: Orquestrador)
      (**feito** em 23/10/2026 na correção `2026-10-23-casca-prazo-do-dado`, `6d1a2d3`: o caso lia o relógio quando a espera
      do Playwright percebia o dado, nos degraus de 100/250/500/1000 ms, e não quando ele apareceu, a ~4,1 s; agora conta o
      instante da página. Se passar de 5 s assim, a investigação vai para o peso da primeira carga. `areas.spec.ts:647` e
      `troca-de-escola.spec.ts:156` ficaram fora: entram se caírem de novo, ou no censo de prazo do e2e da X7.)
- [x] **(X5, retrospectiva) Código de processo que a X5 pediu** (`tasks/prd-reengenharia/retro.md`, P4 e M1 a M7). **Destino que o
      Joaquim deu em 23/10/2026: a X7 (`harness`)**, a próxima spec, antes da X4, com teste e revisão, junto das
      M1 a M3 da X3 (item "(X3, retrospectiva) Código de processo", acima); a correção do `casca.spec.ts:67` parte antes dela. (P4)
      `.github/workflows/ci.yml` com `concurrency: { group: esteira-${{ github.ref }}, cancel-in-progress }` só em `spec/**` e
      `correcao/**` (44 de 91 execuções da spec canceladas à mão); entra com a M1, porque é ela que impede o cancelamento de virar
      vermelho, e com o caso em `tools/ci/esteira.test.ts`. (M1) `tools/processo/esteira.ts`: `cancelled` é `superada`, e o veredito
      é o da execução concluída mais nova, com os jobs vermelhos no texto (o knip da 24.0 ficou ~2 h 20 vermelho sem ninguém ver).
      (M2) `tools/processo/linhas.ts encontro` roda `npm run typecheck` e `npm run lint` depois do merge e recusa o encontro
      vermelho (o crítico da validação: a supressão órfã do encontro da 13.0 com a 90.0). (M3) `tools/processo/mutacoes.ts` com
      timeout por mutação, e o estouro conta como mutação recusada, não como vermelho (19.0: 41 min de `flock`). (M4) `mutacoes.ts
      --faltando`: as linhas acrescentadas de produção com condição (`if`, `&&`, `||`, `??`, `?:`, `case`, `where`, expressão
      regular) que nenhum bloco alcança, impressas pelo portão para o Implementador declarar o bloco ou o motivo antes da Mesa (grupo
      A: 10 reprovações). (M5) `linhas.ts abandonar <n>`. (M6) o portão para o despachante e os workers do compose de teste antes da
      integração. (M7) o portão chama as guardas pelas etapas de `tools/ci/etapas-de-guarda.ts`, as mesmas do `ci:verificar`.
      (dono: Orquestrador) — *feito na X7 (3.0, 5.0, 6.0, 7.0, 8.0, 9.0), pousada em `aad6d14`; o que sobrou está na retro da X7.*

## Da X7 (harness), fora dela

Da retrospectiva da X7 (`tasks/prd-harness/retro.md`), aceitas pelo Joaquim em 24/10/2026 ("tudo o recomendado"). **As M1 a
M7 partem como correções antes da primeira tarefa da X4**, pelo `/corrigir`, cada uma com o portão e os revisores que o caminho
pede. (dono: Orquestrador)

- [x] **(X7, retro, M1) O `mutacoes.ts --faltando` lê também `tools/`** (feito em 24/10/2026, correção
      `2026-10-24-mutacoes-faltando-le-tools`, `7c88705`): `linhasNovasDaArvore` (`tools/processo/mutacoes.ts:678`)
      passa a incluir `tools/` no diff e nos arquivos novos, fora `*.test.ts` e `__fixtures__/`, com teste e bloco de mutação. As 8
      reprovações de cláusula sem bloco da X7 estavam todas em `tools/`, que o `--faltando` não lia
- [ ] **(X7, correção M1) O `--faltando` lê o arquivo novo antes de filtrar** (`tools/processo/mutacoes.ts:696-701`): um
      arquivo novo ilegível (link para pasta, sem permissão, binário) derruba o `--faltando` e o portão com `EISDIR`; filtrar com
      `ehArquivoDoFaltando` antes do `readFileSync`, com teste e bloco de mutação. O risco já existia em `apps/` e `packages/`;
      junto, o título "Linhas novas de produção" do relatório, que agora lista também `tools/`, e o RF5 em
      `tasks/prd-harness/cenarios.md:17` (dono: Arquiteto; origem: `tasks/correcoes/2026-10-24-mutacoes-faltando-le-tools.md`,
      revisor-geral e test-engineer 1ª)
- [ ] **(X7, correção M1) A regra 17 vale para o texto embutido em `tools/`** (`tools/ia/`, `tools/demonstracao/`): agora a linha
      nova de `tools/` aparece no stdout do `--faltando` e no log da esteira; escrever em `docs/lgpd.md` ou na regra 20 que esse
      texto é sintético, sempre (dono: Joaquim; origem: a mesma correção, privacy-guardian 1ª)
- [x] **(X7, retro, M2) Mutação vermelha só vale por asserção** (feito em 24/10/2026, correção
      `2026-10-24-mutacao-so-por-assercao`, `c6c431a`): em `tools/processo/mutacoes.ts`, a mutação que deixa o teste
      vermelho por erro de carga (sintaxe, módulo que não carrega, nenhum teste rodou) é recusada com o motivo e não conta como
      provada (4.0, bloco com erro de sintaxe; 18.0, três mutações vermelhas por exceção)
- [ ] **(X7, correção M2) O que a M2 deixou**: (1) a herança do ambiente pelo `tools/ci/executar.ts`
      (`{ ...process.env, ...etapa.ambiente }`) até o Playwright do `tools/ci/e2e.ts` foi conferida só por leitura: prová-la pede
      subir o compose do e2e; (2) o cabeçalho de `tools/processo/mutacoes.ts` cita dois dos três casos de carga; (3) a mutação em que
      um caso roda e lança (`TypeError` no lugar da asserção) ainda conta como provada: separar exceção de asserção dentro do caso é
      outro mecanismo, no Vitest e no Playwright (dono: Arquiteto; origem: `tasks/correcoes/2026-10-24-mutacao-so-por-assercao.md`)
- [x] **(X7, retro, M3) O portão avisa a divergência que ficou só no documento da tarefa** (feito em 24/10/2026, correção
      `2026-10-24-portao-avisa-divergencia`, `a8c81a9`): em `tools/processo/portao-local.ts`,
      se a seção "Divergências resolvidas nesta tarefa" ganhou linha no diff e nem a `techspec.md` nem o `cenarios.md` da spec
      mudaram, o portão imprime o aviso; só informa, como o `--faltando` (15.0, 18.0, 19.0; duas na X5)
- [ ] **(X7, correção M3) O filtro `/^nenhuma\b/i` de `tools/processo/divergencias.ts:19` descarta também a divergência de
      verdade que começa por "Nenhuma"**: exigir a célula ou a frase inteira ("nenhuma", "Nenhuma divergência"). O aviso só informa, e
      o erro cai para o lado de calar; muda o que `ehDivergencia` conta, com teste e bloco de mutação (dono: Arquiteto; origem:
      `tasks/correcoes/2026-10-24-portao-avisa-divergencia.md`, revisor-geral 1ª)
- [x] **(X7, retro, M4) A esteira não roda no push das branches de linha** (feito em 24/10/2026, correção
      `2026-10-24-esteira-sem-branch-de-linha`, `b1011e9`): em `.github/workflows/ci.yml`, `on.push.branches` ganha
      `'!spec/**--l*'` depois de `'spec/**'`, com o caso em `tools/ci/esteira.test.ts`, o comentário do topo do `ci.yml` e o texto da
      regra 40 ("A esteira", que diz que o commit vai à branch da linha e cada push dispara tudo). Na X7, do push ao veredito, mediana
      de 70 min e máximo de 4 h 26; um job esperou 3 h 38 por máquina, e 34 das 83 execuções eram das linhas
- [ ] **(X7, correção M4) Textos que ainda dizem que a esteira roda em todo push de `spec/**`**, sem a exceção da linha: o
      cabeçalho de `tools/processo/esteira.ts:1-2`, `.claude/skills/corrigir/SKILL.md:102` (e a frase igual no passo "Commit e push"),
      e a D79 em `docs/decisoes.md` (pela `registrar-decisao`); e a frase nova da regra 40 ("A esteira") pode citar, no formato
      "Checagem:", o teste que prova que o `segredo` é suíte exigida do portão local, que a correção não localizou (dono: Arquiteto;
      origem: `tasks/correcoes/2026-10-24-esteira-sem-branch-de-linha.md`)
- [x] **(X7, retro, M5) Correção "processo seguro"** (feito em 24/10/2026, correção `2026-10-24-processo-seguro`,
      `e9794ef`): (1) `.processo/limpeza.json` ancorado no térreo, no comando dos passos 6 e 9
      (pelo `git rev-parse --git-common-dir`) e no `contexto-inicial.sh` (pelo `$CLAUDE_PROJECT_DIR`), e o `vigia.ts` com motivo
      legível para o JSON que não é objeto (`null`, `[]`, texto), com os blocos de "Mutações" de `20_task.md` que mudam; (2) Ctrl-C
      no portão devolve o arquivo mutado (hoje o `finally` não roda) e SIGTERM ao grupo também no `close` do teste que deixa neto
      vivo (7.0, 1ª); (3) bloco de mutação para o ramo `if ('vermelho' in conferencia)` do `portao-local.ts` (7.0, 2ª); (4) `git
      config --get core.hooksPath` liberado em sessão de papel, como leitura (`tools/processo/comando-git.ts:422`, m1 da validação);
      (5) o CLI de `linhas.ts` escreve na saída quando `EDUCA_ENCONTRO_SOB_A_TRAVA` ou `EDUCA_COMANDO_DE_INSTALACAO` está ligada, e a
      marca `abertura` sai junto com `abrindo: false` (5.0); (6) o teste "o SIGINT no supervisor leva o grupo do teste junto"
      (`mutacoes.test.ts`) sem a corrida que o deixou vermelho em `d76ef01` (esperava 124, veio 255)
- [ ] **(X7, correção M5) O que a M5 deixou**: (1) o supervisor da mutação devolve a fonte sempre, mesmo que alguém a tenha
      editado no meio: restaurar só se o conteúdo atual for o mutado (ou o hash do mutado em `--restaurar`); (2) `restaurarOArquivo`
      usa `writeFileSync`, e um leitor que abra a fonte nesse instante pode pegá-la pela metade (vale quando o portão rodar junto com
      outro leitor); (3) o `kill` só ao portão, sem o supervisor, só devolve a fonte quando o teste acaba ou estoura (até 10 min):
      fechar pede o portão assíncrono; (4) os blocos de mutação antigos de `7_task.md`, `5_task.md` e o do `aviso-de-sessao.sh` em
      `20_task.md` ficaram sem reescrever (dono: Arquiteto; origem: `tasks/correcoes/2026-10-24-processo-seguro.md`, infra-guardian)
- [ ] **(X7, correção M5) Três testes com prazo apertado na esteira** `40128021627` (24/10/2026, tentativa 1 vermelha, tentativa 2
      verde, sem mudança de código entre as duas; a M5 não toca nenhum deles): (1) `infra/test/jobs.int.test.ts` › "SIGTERM no worker
      no meio do job: ele termina o job antes de sair, com código 0" (`expected 'running 0' to be 'exited 0'`); (2)
      `e2e/pecas-galeria.spec.ts:16` [celular] e (3) `e2e/pecas-ia.spec.ts:443` [celular], os dois com o axe, no prazo de 30 s. Ver se
      reaparecem; se sim, correção com a causa (dono: Orquestrador, que vigia a esteira). **Reapareceu** (X4, 24/10/2026 ~23:45): a
      esteira da `develop` `40144205508` caiu no e2e 2/7 (`e2e/operacao-convite-coordenacao.spec.ts`, W1, W6, W10 e W3 no
      `chromebook`, elemento que não apareceu) e ficou verde na 2ª tentativa, sem mudança de código
- [x] **(X7, retro, M6) A citação por número de decisão soma o `conformidade-reviewer`** (feito em 24/10/2026, correção
      `2026-10-24-decisao-soma-conformidade`, `bc50587`): nas "Regras de casamento" de
      `tools/processo/guardioes-por-caminho.ts`, o arquivo de exceção que cita D45, D47, D55 a D59 ou D64 soma o
      `conformidade-reviewer`, como a citação da regra 70 já soma (revisão da spec da X7, rodada 4)
- [ ] **(X7, correção M6) As outras decisões que as regras traduzem também somam o guardião delas**: (1) as da regra 20 (D10,
      D35, D62, D66) somam o `privacy-guardian` em arquivo de exceção, com a mesma forma do termo da M6 (D maiúsculo, sem letra,
      dígito, `_` ou `#` colado); (2) D60, D66, D68 e D70, que a regra 70 também cita, entram no termo do `conformidade-reviewer`,
      tirando D60 da lista "não soma" do teste. Muda o conjunto de guardiões de um arquivo, com teste e bloco de mutação (dono:
      Arquiteto; origem: `tasks/correcoes/2026-10-24-decisao-soma-conformidade.md`, privacy-guardian e conformidade-reviewer 1ª)
- [x] **(X7, retro, M7) Correção "acabamento de texto da X7"** (feito em 24/10/2026, correção
      `2026-10-24-acabamento-de-texto-x7`, `8bcd4aa`): (1) os comentários que dizem que a lógica do hook mora em
      `revisoes.ts` (`tools/ci/etapas-de-guarda.ts:119`, `tools/ci/e2e-que-cita-literal.ts:4`, `tools/processo/sequencia-do-portao.ts:80`,
      e o `executar-task/SKILL.md` com `MARCAS_DE_DIRETIVA` e `DOCUMENTO_QUE_UMA_SUITE_LE`), o cabeçalho de
      `tools/processo/harness/metadados.test.ts:12` (sem a regra e o `settings.json`) e a frase morta do
      `.claude/hooks/contexto-inicial.sh:27` ("Checkout anterior à X7"); (2) a regex do caso dos módulos apagados em
      `hook-git.int.test.ts:184` exige o nome do módulo, com `replaceAll`; (3) `retro/SKILL.md:91`, "salvo as do grupo seguinte",
      trocado junto com o termo do `seguir.test.ts:140`; (4) o retoque do `passos/6-tarefa.md` (m6 da validação: "Não chega como
      mensagem:" de volta ao `PEDIDO de estado`, e "e reabra com `abrir`") e uns 300 B de folga no orçamento de 24.000 B
      (`SKILL.md` + `protocolo.md` + `passos/6-tarefa.md`, hoje 23.979), tirando explicação e não instrução; (5)
      `docs/aia/ouro-retido/README.md:4` sem o `(ouro: <política>)`, que não existe mais (18.0)
- [ ] **(X7, correção M7) As outras citações de `tools/processo/revisoes.ts` como dono do hook** (`hook-revisoes.ts`, com a lógica em
      `portao.ts`, `caducidade.ts`, `comando-git.ts` e `documento-de-revisao.ts`): `tools/guardas/escopo-dos-repositories.ts:254`
      (comentário), `tools/processo/documento-de-revisao.ts:48`, `:204` e `:329` (texto que o hook grava nos documentos),
      `.claude/skills/criar-tasks/task-template.md:171`, `.claude/skills/revisar-tarefa/SKILL.md:14` e `.claude/skills/seguir/time.md:25`.
      O `revisar-tarefa` e o `time.md` são confirmação do Joaquim, não aviso (dono: Implementador, numa correção própria; origem:
      `tasks/correcoes/2026-10-24-acabamento-de-texto-x7.md`, revisor-geral e test-engineer 1ª)

Ficam, de antes da retro:

- [ ] **(X7, Tech Spec §9) Remover `tools/processo/separar-achados.ts` e o teste dele**: o hook já separa os achados por
      documento desde a X5, e o script só serviu para a migração. Espera o ok do Gabriel (U11-10), porque ele roda o
      processo na branch dele. (dono: Joaquim, com o Gabriel)
- [ ] **(X7, tarefa 12.0) `tools/ci/conferir-entregas.ts` e o merge com mais de dois pais, e a linha "remerge CONFLICT".** (i) Não há
      teste de merge octopus: o `git show --remerge-diff --name-only` talvez não liste nada nele, e um octopus com código resolvido à
      mão passaria sem marca. Falta o experimento com o git (versão 2.56 aqui), e, se for o caso, ou código que trate o merge de mais de dois
      pais ou o limite escrito na Tech Spec §5(a); (ii) o item (ii) de `TODO.md:967`, a linha `remerge CONFLICT` que o
      `--remerge-diff --name-only` pode imprimir num conflito que não é de conteúdo (modify/delete, por exemplo), vale também aqui: a linha
      seria lida como nome de arquivo, e não é código. Juntar os dois quando o Arquiteto decidir, na tarefa futura que mexer no
      `--remerge-diff` (dono: Arquiteto; origem: `12_task.md`, "Recomendações sem aplicar")
- [ ] **(X7, 4.0) A guarda do anexo do censo do e2e** (`tools/ci/esteira.test.ts:410-416`) procura só `.attach(` em `e2e/**/*.ts`:
      não pega `testInfo.attachments.push(...)`, `testInfo['attach'](...)`, helper fora de `e2e/` nem `console.` num spec. Hoje nenhum
      spec faz isso, e a garantia principal é o dado sintético; estender quando o e2e usar dado que não é montado na hora (dono:
      Arquiteto; origem: `4_task.md`, test-engineer, revisor-geral e privacy-guardian 2ª rodada)
- [ ] **(X7, 4.0) Antes da primeira escola real: rever o upload do censo do e2e** como artefato da esteira num repositório público,
      quando o staging (D31) ou um e2e contra ambiente com dado real existir (dono: Joaquim, no portão da primeira escola real;
      origem: `4_task.md`, privacy-guardian 2ª rodada)
- [ ] **(X7, 19.0) Quem revisa a skill `lgpd-brasil` quando o `npx skills update -p` trouxer versão nova**: ela já está atrás do ECA
      Digital (`docs/processo-licoes.md`, seção 2), e skill vira instrução (dono: Joaquim; origem: `19_task.md`, privacy-guardian 1ª)
- [ ] **(X7) Dois e2e no limite**: (1) o lote 5/7 do e2e passou dos 45 min do job na correção do `casca`; o RF2 já marca o prazo
      estourado de vermelho, com o nome do job, mas o lote continua no limite; (2) na fixture `e2e/casca.ts`, o passo do código do MFA
      tem a mesma causa possível do Redis de fila parado 2 s, e falha em 20 s com o erro certo (relatório da correção
      `agentes-suspensao-intermitente`). Voltam como correção se caírem de novo (dono: Orquestrador)
- [ ] **(X7, correção `2026-10-24-comando-da-limpeza-apaga-debaixo-do-disparo`) Acabamento de `tools/processo/vigia.test.ts`**:
      (1) o caso `roda no térreo…` monta `join(raiz, 'disparou.txt')` à mão e o helper já devolve esse caminho em `marca`; (2) o
      comentário do `rodarOComando` diz que ele "só devolve com ele terminado", mas ele só espera a marca ter conteúdo; (3) o helper
      `rodar` (~linha 245) e o `ambienteGit` (~linha 285) ainda usam `{ ...process.env }` e herdariam o `GIT_DIR` de um hook do git.
      Fazer na próxima correção que tocar a vigia (dono: Orquestrador; origem: a correção, `test-engineer` e `revisor-geral` 2ª)
- [ ] **(X4, 2.0) Teste de API: encerrar a sessão duas vezes é idempotente** (`DELETE /v1/sessao` com a mesma sessão, a segunda
      sem erro e sem rotacionar o cookie de novo). Hoje não é bug: a casca trava o segundo clique, e a web trata `NAO_AUTENTICADO`
      como "não há o que encerrar". É teste de `apps/api`, fora dos arquivos da 2.0 (dono: Orquestrador; origem: `2_task.md`,
      `infra-guardian` 1ª)
- [ ] **(X4, 4.0) "Encerrada" cai em "Entregues", e o aluno que respondeu 0 de 3 lê que entregou.** A subtarefa 4.1 põe `enviada`
      e `encerrada` no mesmo grupo, e o título "Entregues" diz mais do que o fato: quem a professora encerrou antes de ele
      responder não entregou nada. Decidir o texto do grupo ou um grupo à parte, e cobrir o caso com teste (aluno com
      `encerrada` e `respondidas: 0`). Quem decide: o Validador, com o produto (dono: Validador; origem: `4_task.md`,
      `conformidade-reviewer` e `test-engineer` 1ª)
- [ ] **(X4, 4.0) O vazio de cada grupo olha só as páginas carregadas.** "Nenhuma corrigida ainda." pode aparecer com "Ver mais
      tarefas" logo abaixo, e a página seguinte trazer uma corrigida. A tarefa recusou o contador no título pelo mesmo motivo.
      Decidir o texto (por exemplo, "Nenhuma corrigida nas que já abriram") ou esconder o vazio enquanto houver página
      seguinte (dono: Validador; origem: `4_task.md`, `infra-guardian` 1ª)
- [ ] **(X4, 4.0) Em 360 px o título da tarefa é cortado em uma linha** ("Cinemática: lista sinté…"). É o desenho da `Linha` da X1
      (`componentes/ui/Linha.tsx`: título numa linha, com reticências e o `title` com o texto inteiro). Reavaliar se o aluno
      precisa ler o título inteiro no celular, e então deixar a `Linha` quebrar em até duas linhas (dono: Arquiteto, na
      próxima spec que toque a `Linha`; origem: `4_task.md`, `frontend-reviewer` 1ª)
- [ ] **(X4, 4.0) A reserva de matéria é `anil` com livro aberto e parece Física pela cor.** O `Ladrilho` só tem as dez
      famílias de cor e nenhuma é neutra; a divergência está em `4_task.md` e em `docs/interface.md` 9.1. Quando a X1 ganhar uma
      família neutra, trocar a reserva de `areas/aluno/materia.ts` e o teste de `materia.test.ts` (dono: Arquiteto, com a X1;
      origem: `4_task.md`, `frontend-reviewer` 1ª)
- [ ] **(X4, 4.0) O texto da tela de Tarefas ainda diz "atividade".** "Carregando as suas atividades…" e "Quando quem dá a aula
      passar uma atividade para a turma…" ficaram, porque o rótulo do carregando é o mesmo que `e2e/minha-turma.spec.ts` e
      `Inicio.test.tsx` citam, e mudar um sem o outro deixa dois lugares diferentes. Trocar os dois textos e os specs que os
      citam na mesma correção (dono: Orquestrador; origem: `4_task.md`, `revisor-geral` 1ª)
- [ ] **(X4, 4.0) `FamiliaDeCor` é importado de `componentes/ui/Contador`.** `materia.ts` busca o tipo no arquivo do `Contador`,
      que não é de quem desenha o `Ladrilho`; o `Ladrilho` podia reexportar o tipo. É da X1 (`componentes/ui/`), com o teste
      `casca-sem-import.test.ts` que descreve a cadeia (dono: Arquiteto, com a X1; origem: `4_task.md`, `revisor-geral` 1ª)
- [ ] **(X4, 4.0) O e2e de 360 px de Tarefas acha o nome da linha pelo `[title]`**, detalhe interno da `Linha`. Um `data-*` na
      `Linha` seria mais robusto, e o e2e passaria a usá-lo (`e2e/aluno-atividade.spec.ts`, "Tarefas a 360 px"). A mudança é na
      `Linha`, da X1 (dono: Arquiteto, com a X1; origem: `4_task.md`, `revisor-geral` 1ª)
- [ ] **(X4, 6.0) A ordem do Tab na tarefa aberta: "Anterior" e "Próxima" vêm no DOM depois de "Enviar a atividade" e de "Pedir
      ajuda ao Tutor".** A barra presa é o último bloco, e o envio fica acima dela. Reavaliar se o envio vai para dentro da barra,
      como no mockup 2.3a (muda a estrutura da tela, e por isso não é barata). O Validador confere a forma contra o mockup 2.3a
      (dono: Validador; origem: `6_task.md`, `frontend-reviewer` 1ª)
- [ ] **(X4, 6.0) O dado da vitrine cheia se contradiz:** a tarefa corrigida diz "Você respondeu 0 de 4 questões" ao lado de
      "Você acertou 3 de 4". É o semeador de `tools/vitrine/`, fora dos arquivos da 6.0: semear as respostas da atividade
      corrigida (dono: Orquestrador; origem: `6_task.md`, `frontend-reviewer`, `conformidade-reviewer`, `revisor-geral` e
      `privacy-guardian` 1ª)
- [ ] **(X4, 6.0) A fala da comemoração sai assinada pelo Tutor, mas quem corrige é o "Assistente · correção de objetiva".** Mudar a
      assinatura da `Comemoracao` muda a peça: decidir com o `frontend-reviewer` na próxima tarefa que tocar a peça (dono:
      Arquiteto; origem: `6_task.md`, `conformidade-reviewer` 1ª)
- [ ] **(X4, 6.0) O `\b` do teste de falas não reconhece palavra acentuada** (`atividade.test.ts`, "as falas da comemoração"): trocar
      por `(?<![\p{L}])…(?![\p{L}])` com a flag `u` quando a lista ganhar palavra com acento. Hoje funciona (dono: quem mexer nas
      falas; origem: `6_task.md`, `conformidade-reviewer` 1ª)
- [ ] **(X4, 6.0) `e2e/aluno-atividade.spec.ts` copia a fala da comemoração à mão** em vez de importar `FALA_DA_ENTREGA`. Depende de
      o e2e poder importar de `apps/web`, que não foi verificado (dono: Arquiteto; origem: `6_task.md`, `revisor-geral` 1ª)
- [ ] **(X4, 6.0) O 503 do envio simula a queda de rede; a falha de verdade é o `fetch` rejeitado.** O caminho do cliente é o mesmo,
      mas um caso com `fetch` rejeitado fecha a dúvida. Entra na tarefa que tocar `Atividade.test.tsx` ou a `redeFalsa` (dono:
      Arquiteto; origem: `6_task.md`, `test-engineer` 1ª)

- [ ] **(gitleaks na pasta, 25/10/2026) A cópia temporária do `guarda:segredo` é legível por qualquer usuário da máquina:**
      `pastaComoRepositorio` (`tools/ci/pasta-como-repositorio.ts`) faz `chmod -R a+rX` para o usuário do contêiner do gitleaks
      ler a pasta, e a pasta tem o conteúdo inteiro dos arquivos alterados até o fim da varredura. Efeito pequeno, e já era
      assim antes da correção `2026-10-25-gitleaks-pasta-perdoa-documento-de-tarefa`. Limitar ao UID da imagem fixada exige
      medir qual ele é; muda comportamento, por isso não entrou na correção (dono: Arquiteto; origem: `privacy-guardian`, 1ª;
      `infra-guardian` na mesma correção)
- [ ] **(gitleaks na pasta, 25/10/2026) Comentário velho em `tools/ci/etapas-de-guarda.ts`:** o JSDoc de `GuardaDaEsteira` diz que
      `tools/ci/segredo.ts` monta as etapas do segredo; desde a mesma correção elas moram em `tools/ci/etapas-do-segredo.ts`.
      Uma linha de comentário; mexer no arquivo caducaria quem já aprovou (`revisor-geral`, 2ª)

- [ ] **(e2e do Uso, 25/10/2026) Comentário falso em `e2e/operacao-uso.spec.ts` (W6, perto da linha 145):** diz que o W6 do outro
      projeto "passa as oito dele na frente", mas o painel `topo` tem 2 escolas com uso. Trocar "as oito" por "as duas" na próxima
      correção que tocar o arquivo; é uma palavra de comentário, sem efeito no teste (dono: quem mexer no spec; origem: correção
      `2026-10-25-uso-da-operacao-sem-escola-no-e2e`, `test-engineer` 2ª)
- [ ] **(e2e do Uso, 25/10/2026) A conta do pior caso de `UsoDoPainel` (`e2e/__fixtures__/painel.ts`) não vale com `--repeat-each`:**
      ela conta uma instância de cada caso por projeto. Com `--repeat-each=3` e 6 trabalhadores podem ficar vivos até 6 painéis
      `comum` (até 40 escolas na frente, mais que as 25 da página). A esteira e o portão rodam sem repetição; acrescentar a
      ressalva ao comentário do tipo na próxima mexida no fixture (dono: quem mexer no fixture; origem: mesma correção,
      `test-engineer` 2ª)
- [ ] **(e2e do Uso, 25/10/2026) `removerEscolaSemConvite` aceita qualquer `EscolaDoConvite`, inclusive a `pendente`,** que tem
      convite e conta e não seria apagada por inteiro. Estreitar o tipo ou conferir o `rowCount` do `delete`. Hoje só a
      `sem_convite` chega lá (uso único, no `afterEach` do `operacao-uso`); entra com a correção da limpeza do banco de teste
      (dono: Arquiteto; origem: mesma correção, `test-engineer` 2ª)
- [ ] **(e2e do Uso, 25/10/2026) Limpeza do banco de teste:** as escolas de convite (`semearEscolaDoConvite`) e as que a tela cria
      ficam no banco local a cada execução e empurram as de quem procura a primeira página por nome. Correção própria, que também
      leva o item do `removerEscolaSemConvite` acima (dono: Arquiteto; origem: mesma correção, `conformidade-reviewer`,
      `tenancy-guardian`, `privacy-guardian` e `infra-guardian` 1ª)

Saíram na retro da X7, com o motivo em `tasks/prd-harness/retro.md` ("Tirar do `TODO.md`"): o resto das recomendações da
revisão da spec (rodada 4), da 2.0, da 5.0, da 7.0, da 11.0, da 12.0 (o `catch` do `rev-list`), da 17.0, da 18.0 e da 19.0,
e os menores m2 e m5 da validação.

## Da X4 (telas do aluno e primeiro acesso), fora dela

Levados no fechamento da X4 (26/10/2026). Os menores das quatro rodadas estão em
`tasks/prd-telas-do-aluno-e-primeiro-acesso/validacao.md`, seção 4 de cada rodada; os já registrados acima (M5, a vitrine sem
tarefa "Para fazer"; M8, o nome de 60 caracteres no Eu; MN2, a fixture `MENSAGEM_FIXA`; MN3, a redação da frase do aviso) não se
repetem aqui.

- [ ] **(X4, validação, MN1) O roteiro da demonstração manda a coordenação a "Estrutura" e a "IA"**, lugares que não estão na
      navegação dela desde a X2: no 2.3 a 2.7 o lugar é **Escola** (abre na aba Turmas) e o "Alocação" do 2.7 vira "Acrescentar
      turma"; no 2.2 e no 9.1 o lugar é **Registros** (abre na aba IA). Correção de texto em `docs/roteiro-da-demonstracao.md` que
      confira cada passo da coordenação contra `e2e/roteiro-da-demonstracao.spec.ts`, **antes da próxima demonstração** (dono:
      Orquestrador; origem: validação, rodada 4, e `revisor-geral` da correção do roteiro, rec. 3)
- [ ] **(X4, validação, MN4) Gerar de novo o `apps/web/dist` antes de qualquer demonstração**: o que está lá ainda tem a frase
      antiga da mensagem fixa do Tutor. Vale como passo do roteiro, junto do MN1 (dono: Orquestrador; origem: `revisor-geral`,
      correção `2026-10-26-mensagem-fixa-avisa-o-professor`, 2ª)
- [ ] **(X4, validação, MN5) `docs/mvp-rapido.md:245-246` ainda diz que a mensagem fixa diz "seu professor" e espera o Joaquim**:
      a decisão foi tomada (26/10/2026, A). Basta uma nota apontando a correção `2026-10-26-mensagem-fixa-avisa-o-professor`
      (dono: quem tocar `docs/mvp-rapido.md`)
- [ ] **(X4, validação, M1) A região do aviso de privacidade fica baixa no computador** (`componentes/introducao/RegiaoQueRola.tsx`,
      passo 3 do aluno): mostra três das 17 frases e deixa uns 110 px vazios antes do "Continuar". Deixar a região ocupar a altura
      livre (dono: frontend, na próxima tarefa que mexer na introdução)
- [ ] **(X4, validação, M2) A 360 px o título da tarefa sai cortado com reticências** na lista do aluno (`componentes/ui/Linha.tsx`,
      `areas/aluno/Atividades.tsx`): usar `tituloEmDuasLinhas`, como em "Rever a introdução" (dono: frontend)
- [ ] **(X4, validação, M3) O papel aparece em minúsculo ("aluno") no rodapé da lateral** da casca da X1
      (`componentes/CascaDaEscola.tsx`) (dono: frontend, na casca)
- [ ] **(X4, validação, M6) `apps/web/src/areas/aluno/Eu.test.tsx:21`, `:317` e `:329` ainda falam do "cartão da turma"**, que saiu
      na correção do Eu: trocar por "a turma no cabeçalho" (dono: quem tocar `Eu.test.tsx`)
- [ ] **(X4, validação, M7 e M11) As leituras do "cabe em 1366 × 768" (RF20) fora da Tech Spec §12b**: a do Eu ("duas tarefas
      corrigidas, tamanho Padrão") está só na §9, e a da tarefa aberta (enunciado de uma a duas linhas, quatro questões, duas
      habilidades, tamanho Padrão) está só em `tasks/correcoes/2026-10-25-tarefa-aberta-cabe-em-1366.md`. Levar as duas à §12b,
      que é o que o Joaquim revê; e `tasks/correcoes/2026-10-25-eu-cabe-em-1366.md:40` cita a 9.3 de `docs/interface.md` onde a
      frase está na `:603` (dono: Arquiteto)
- [ ] **(X4, validação, M9) A tarefa aberta rola de 36 a 71 px a 1024 × 768 e a 800 × 768** (`areas/aluno/Atividade.tsx:239`):
      "Anterior" e "Próxima" quebram para uma segunda linha. Nada fica coberto e o RF20 só pede 1366, mas o Eu e o Início cabem a
      1024. Pôr os dois em `compacto` a partir de 1024, ou o ponto de parada numa linha abaixo de "Enviar" (dono: frontend)
- [ ] **(X4, validação, M10) A 360 px a região de status vazia (`min-h-6`) da tarefa aberta** abre um vão de ~50 px entre a última
      alternativa e "Pedir ajuda ao Tutor nesta questão" (`Atividade.tsx:208-227`); só visual (dono: frontend)
- [ ] **(X4, validação, M12) Recomendações da correção `2026-10-25-tarefa-aberta-cabe-em-1366`**: (1) degradê ou sombra no pé da
      lista que rola, para mostrar que há mais questões (`frontend-reviewer`, 1ª); (2) quebrar em duas a linha do comentário acima
      de `listaRola` (`Atividade.tsx:303`, `frontend-reviewer`, 2ª); (3) prender o localizador de `e2e/aluno-atividade.spec.ts:656`
      à seção "Questão por questão", para um segundo `ol` no resumo não mudar o elemento medido (`test-engineer`, 2ª). E a
      contradição "respondeu 0 de 4" com "acertou 3 de 4" aparece também na foto da corrigida real: ver o item "(X4, 6.0) O dado
      da vitrine cheia se contradiz", acima (dono: quem tocar `Atividade.tsx` ou o resumo do resultado)
- [ ] **(X4, correção `2026-10-25-inicio-cabe-em-1366`) Duas recomendações do `test-engineer` (2ª)**: (1) em
      `e2e/aluno-inicio.spec.ts:118-119`, o limite `<= ALVO_DE_TOQUE_PRINCIPAL_PX + 1` não prova "numa linha só" (o link mede 44 px
      também com duas linhas de 18 px): contar as linhas do texto do link pelos retângulos de um `Range`; (2)
      `tasks/correcoes/2026-10-25-inicio-cabe-em-1366.md:26` cita o nome antigo do caso ("a 360 px…") e não fala do caso novo
      (dono: quem tocar `e2e/aluno-inicio.spec.ts`)
- [ ] **(X4, correção `2026-10-25-montar-arquivo-renova-validade`) Janela de corrida no arquivo do titular** entre a guarda
      (`montar-arquivo.ts:53`) e a gravação do objeto (`:69`): se a eliminação do titular apaga o objeto nesse intervalo, o job o
      grava de novo. Conferir de novo dentro da transação, ou o expurgo varrer objetos sob `titular/<escola>/` sem linha. Janela de
      segundos, e já existia antes (dono: Arquiteto; origem: `privacy-guardian`, 1ª)
- [ ] **(X4, mesma correção) Registrar o caso sem guarda do arquivo do titular** (pedido `concluido` cujo arquivo foi montado e
      apagado junto com a linha, reentregue depois de 7 dias) no mapa de retenção de `docs/lgpd.md` e como risco conhecido no
      runbook (dono: Arquiteto; origem: `privacy-guardian` e `infra-guardian`, 1ª)
- [ ] **(X4, mesma correção) Fechar o caso sem guarda com um marcador no pedido** (por exemplo `arquivo_montado_em`), gravado na
      mesma transação. Pede coluna e migration (dono: Arquiteto; origem: `test-engineer`, 1ª)
- [ ] **(X4, Implementador 2) O `-t` do Vitest lê parênteses do nome do teste como regex**: a mutação que filtra por nome com
      parênteses fica "verde" sem rodar caso nenhum. Escapar o nome em `tools/processo/` onde a mutação monta o `-t`, ou exigir
      ao menos um caso rodado (dono: Arquiteto)
- [x] **(X4, validação, MN7) Revisor que roda `npx` de pacote fora do projeto baixa e executa código de terceiros** (feito em 26/10/2026, correção `2026-10-26-npx-sem-instalar`, `e79db867`): na correção
      `2026-10-26-areas-entrar-estoura-o-prazo`, o `tenancy-guardian` rodou `npx biome format`, e o `npx` baixou do npm o pacote
      `biome` 0.3.3, sem relação com o projeto, e o executou no checkout da linha 1 (a árvore não mudou). Os agentes revisores
      (`.claude/agents/*.md`, com `Bash`) só usam `npx` em pacote do `package-lock.json`, e com `--no-install` (dono: Arquiteto, na
      retro da X4; origem: validação, rodada 5). **Retro da X4 (M3, aceita em 26/10/2026), correção própria, a primeira a abrir:**
      `.claude/settings.json` com `"env": { "npm_config_yes": "false" }` (o hook recusa o arquivo fora de tarefa ou correção);
      testado na retro: `npx cowsay` sai com "npx canceled due to missing packages and no YES option" sem baixar nada, e `npx
      playwright` e `npx vitest`, do `package-lock.json`, rodam. O `npx skills update -p` pelo Claude passa a pedir `--yes` (dono:
      Orquestrador; guardiões: `infra-guardian`, `revisor-geral`)
- [ ] **(X4, MN7, correção `2026-10-26-npx-sem-instalar`) O `npm_config_yes=false` vale só para a sessão do Claude Code**: o `env` do
      `.claude/settings.json` não chega à esteira nem à VM de produção. Hoje nada quebra (a esteira roda `npx vitest`, que está no
      `package-lock.json`); se a esteira ou um script passar a rodar `npx` de pacote de fora, decidir se ele leva a mesma barreira
      (dono: Arquiteto; origem: `infra-guardian`, 1ª rodada)
- [ ] **(X4, MN7, correção `2026-10-26-npx-sem-instalar`) Dois textos ainda mandam rodar `npx skills update -p` sem `--yes`**:
      `.claude/skills/seguir/time.md:35` e `docs/skills-de-terceiros.md`; com a barreira, o comando cancela sem o `--yes` (dono:
      Orquestrador; origem: `revisor-geral`, 1ª rodada)
- [ ] **(X4, MN7, correção `2026-10-26-npx-sem-instalar`) Conferir a cada atualização do Claude Code que o `env` do `settings.json` chega
      ao Bash da sessão e dos subagentes**: rodar `npx cowsay oi` numa sessão de verdade e ver "npx canceled due to missing packages and
      no YES option"; o teste novo prova o `npx` com o `env` do arquivo, não a entrega dele (dono: Arquiteto; origem: `test-engineer` e
      `privacy-guardian`, 1ª rodada)
- [ ] **(X4, MN7, correção `2026-10-26-npx-sem-instalar`) Os agentes revisores ainda pedem `--no-install` no texto**:
      `.claude/agents/*.md` dizem para usar `npx` só com `--no-install`; alinhar com a barreira nova, que já cancela o que não está no
      `package-lock.json` (dono: Arquiteto; origem: `privacy-guardian`, 1ª rodada)
- [ ] **(X4, correção `2026-10-26-areas-entrar-estoura-o-prazo`) Os outros 104 `page.goto('/entrar')` do e2e seguem expostos à trava
      da primeira carga sob a rede emulada** (2ª ocorrência; a 1ª foi `2026-10-17-casca-carregando-estoura-o-goto`). Na 3ª, o
      conserto sobe ao harness (`perfis.ts`), em vez de caso a caso (dono: Orquestrador, que vigia a esteira; Arquiteto, na retro).
      **Retro da X4 (M4):** sem esperar a 3ª; entra na correção em lote "primeira carga do e2e", parte (a), no item do censo abaixo
- [ ] **(X4, validação, MN10) A vitrine cheia mostra uma lista de Física com habilidades de Química** no Eu do aluno ("Cinemática:
      lista sintética" com QUI.EM.05 e QUI.EM.06): `e2e/__fixtures__/governanca.ts:179-182` semeia o lote de `fisica` com
      `HABILIDADE_MASSA` e `HABILIDADE_LIMITANTE`. Pôr uma habilidade de Física no lote de Cinemática (dono: quem tocar a fixture da
      governança)
- [x] **(X4, validação, MN11) Revisores de correção só de teste registraram de 13 a 38 s cada um** nas duas últimas correções da X4,
      com achados que mostram leitura do diff: ver na retro se a revisão está na medida certa ou só rápida (dono: Arquiteto, na
      retro da X4). **Retro da X4:** sem mudança; o diff vai no prompt, a correção de um arquivo só de teste não pede abrir nada,
      e os achados citam linha e nome (mediana de 26 s por rodada nas correções de 25 e 26/10, 47 s nas tarefas)
- [ ] **(X4, retro, M2) O portão puxa os specs de jornada** (aceita em 26/10/2026; código de processo, correção própria):
      `tools/processo/portao.ts` (`alvosDoPortao`), diff em `apps/web/src/areas/<papel>/` ou `apps/web/src/componentes/` põe nos
      alvos `e2e/casca.spec.ts`, `e2e/escola-montada.spec.ts` e o de jornada do papel (`aluno-fluxo.spec.ts` para o aluno), com a linha
      `▶ e2e/<arquivo> entra nos alvos: jornada`, sem cobrança de duração; teste e bloco de mutação. Na X4, o W12, o Tutor pausado e
      o W1 caíram só na esteira; até lá vale o parágrafo novo do `executar-task` (P4). Custo: 3 a 5 min de portão por tarefa de tela
      (dono: Orquestrador, numa linha ociosa antes da próxima spec de tela)
- [ ] **(X4, retro) `casosAlterados` conta como do caso tudo até o `test(` seguinte** (`tools/ci/duracao-do-e2e.ts`): um `for` solto
      entre dois casos puxa o vizinho para a medida, e a correção `2026-10-26-tres-casos-do-e2e-perto-do-prazo` teve de usar
      `voltas.forEach((volta) => test(…))` em vez do `for (const … of …)` do projeto. O caso termina na linha que fecha o `test(` dele, na
      indentação dele (MN6; `revisor-geral`, 1ª; dono: quem tocar o portão da duração)
- [ ] **(X4, retro) O push da branch da spec no pouso roda a esteira no mesmo commit que a da `develop`**: `40365404286` vermelha
      (seis casos do celular a 30–32 s) e `40365440626` verde, as duas em `83f1c6d8`, e ninguém lê a primeira. Se voltar a confundir,
      o pouso não empurra a spec (dono: Orquestrador)
- [ ] **(X4, censo do e2e) 36 casos entre 2/3 e 90% do prazo, de antes da X4** (dívida da develop, decisão A do Joaquim em
      26/10/2026; detalhe em `.processo/ordens/diagnostico-censo.md` do andar da X4, §3), em três correções sem arquivo em duas:
      (1) **material**: `e2e/material.spec.ts`, 10 casos; (2) **entrada e sessão**: `convite`, `entrar`, `inatividade`, `areas`,
      `mfa`, `escola-e-vinculos`, `titulo-da-tela` (13 casos); (3) **coordenação e galeria**: `privacidade`, `analista`,
      `governanca` e os 4 `pecas-*`, mais os cinco de 90 s (`alocacao`, `estrutura`, `professores`, `lista-da-turma`, `operacao`),
      16 casos. As `pecas-*` do celular pedem conferir em lote, como na correção `2026-10-16-galeria-da-onca-estoura-o-prazo`
      (dono: Orquestrador, uma correção por linha ociosa, antes da próxima spec que pese no e2e). Os três de `areas.spec.ts` que a
      validação mediu na máquina (`:696`, `:275`, `:572`, MN8 da rodada 5) já estão entre eles. **Primeiro a corrigir:** `e2e/privacidade.spec.ts:253` [celular] ("a segunda pessoa na mesma aba não vê a
      retenção da anterior", grupo 3), que oscila de 24,5 a 27,5 s de 30 e passou de 90% no censo do fechamento da X4
      (`40356513591`); o Joaquim escolheu pousar e levá-lo para cá (26/10/2026, opção A).
      **Retro da X4 (M4, aceita em 26/10/2026): uma correção só, "primeira carga do e2e", antes da X8** (que toca muitos e2e no
      rename), em três partes: (a) a investigação da trava do `goto('/entrar')` (item acima): laço de contextos novos que só fazem
      `goto` sob o perfil, com e sem `Network.emulateNetworkConditions`, em `e2e/__fixtures__/perfis.ts`; (b) a receita das três
      correções da X4 (`tres-casos`, `areas-entrar`, `material-sem-licenca`: entrada pela API e a primeira tela esperada dentro de
      `carregarSemRedeLenta`) num ajudante de `e2e/__fixtures__/`, com o nome dizendo o que ele não mede; (c) os casos deste item, por
      grupo, o `privacidade:253` primeiro, mais os seis do `celular` que passaram de 30 s no push do pouso da X4 (`40365404286`, no
      mesmo `83f1c6d8` que ficou verde na `develop`): `pecas-sobrepor:180`, `pecas-galeria:16`, `pecas-ia:173`, `pecas-ia:443` (claro
      e escuro) e `coordenacao-introducao:201`, este da X4 (dono: Orquestrador)
      **Feito em 29/10/2026** (correção `2026-10-29-primeira-carga-do-e2e`): (a) a trava do `goto('/entrar')` **não se reproduz**: 1.200
      cargas novas, 0 travadas, e a rede emulada custa 2,8 a 3,5 s fixos por primeira carga; não entra nova tentativa no `perfis.ts`
      (esconderia a trava); (b) `abrirPelaApiSemMedirAPrimeiraCarga` (`segundo-fator.ts`) e `entrarPelaApiSemMedirAPrimeiraCarga`
      (`casca.ts`), usados por `material`, `privacidade`, `coordenacao-introducao`, `analista`, `governanca` e cinco casos do professor;
      (c) `privacidade:253` e `:430`, os seis da galeria (`pecas-galeria:16`, `pecas-sobrepor:180`, `:39`, `pecas-ia:173`, `:443`,
      `pecas-botoes:95`, `pecas-superficies:26`, divididos ou medidos numa ida só ao navegador) e o `coordenacao-introducao:201`. **Sobra, do
      censo da esteira `40880199949`** (a lista está na correção, "Recomendações sem aplicar"): o grupo "entrada e sessão" em que a própria entrada
      é o assunto (`convite:154`, `mfa:14` e `:151`, `escola-e-vinculos:211` e `:271`, `troca-de-escola:211`, `casca:386`,
      `pedidos-do-titular:338`, `tokens:215`, `operacao:45`, `areas:275` e `:479`), os seis de 90 s (`alocacao:85`, `professores:249`, `operacao:125`, `estrutura:314`,
      `lista-da-turma:214` e `:519`) `pecas-sobrepor:504` e `pecas-ia:261`. O ajudante `entrarPelaApiComSegundoFator` de dentro de `privacidade.spec.ts` é cópia do de `segundo-fator.ts` e serve ao caso que prova só o endereço (dono: quem tocar `privacidade.spec.ts`). O runner leva uns **três** vezes a máquina nos casos de CPU ×4 (galeria), e não o
      dobro que `tools/ci/duracao-do-e2e.ts` supõe (dono: Orquestrador, uma correção por linha ociosa)

## Da correção 2026-10-28-onca-do-mockup (a onça do mockup), fora dela

- [ ] Medir no Chromebook de referência (D51), na validação, se a rolagem da conversa do Tutor segue fluida com o avatar novo
      (infra-guardian, rodada 1); o avatar do mockup só se mede com tela real
- [ ] O "colégio sintético da vitrine" aparece com id nas fotos da coordenação (`tools/vitrine/`): conferir que o seed não vaza
      id (frontend-reviewer, rodada 1)
- [ ] Da correção `2026-10-28-onca-do-mockup-v2`: se aparecer um segundo export "só para os testes" no código de produção, criar a guarda
      que reprove o uso fora de `*.test.*` (hoje só `esquecerQueAcenou`, em `movimento-da-onca.ts`)
- [ ] Da correção `2026-10-28-onca-do-mockup-v2`: `tasks/prd-pele-e-casca/mockup.md:1369` e `docs/interface.md:1154` ainda descrevem o aceno
      pela chave do `sessionStorage` ou sem dizer que "sessão" é a página aberta; o Arquiteto ajusta na próxima passagem por `docs/interface.md`
- [ ] Da correção `2026-10-28-onca-do-mockup-v2`: congelar a mão de cada pose (`maoD`, punho ou creme, e o `cy` 212 em acenando e apontando) em
      `fidelidade-ao-mockup.test.tsx`, junto da fidelidade da onça
- [ ] e2e com "reduzir movimento" no passo `pensando` da introdução do aluno (test-engineer, rodada 1); o da árvore da
      comemoração entrou na correção
- [ ] Da rodada 2 da onça: `docs/interface.md` (tabela da 9.5) ainda diz que a comemoração usa o `t-salto` (600 ms, `curva-quique`), e o
      salto que ficou é o `onca-comemorar` (500 ms, `ease-out`); nenhum CSS de `apps/web/src` usa o token: alinhar a linha ou tirar
      `--t-salto` do `estilos.css`. E a linha da 9.7 que ainda fala em "movimento próprio do conformidade-reviewer" na `Comemoracao`
- [ ] Da rodada 2 da onça, só de arrumação: `estilos.test.ts` (caso "nenhum CSS de `apps/web/src`… tem laço") faz uma segunda busca
      recursiva de pasta, e o arquivo já tem uma; `Introducao.test.tsx` ("a onça não se mexe: nenhum temporizador entre um passo e
      outro") pede nome revisto; o comentário da prop `animada` em `Onca.tsx` virou uma linha só, longa; os 30 s do caso "nenhuma
      pose agenda temporizador" são arbitrários (basta a contagem antes de avançar o relógio); `Comemoracao.test.tsx` deve dizer
      que um invólucro novo com outra animação só o e2e da árvore pega; `rostoConfere` (`Onca.test.tsx`) lê o rosto num `div`, e
      embrulhar num `<svg>` evita falhar pelo motivo errado
- [x] *(feito na correção `2026-10-28-onca-do-mockup-v4`, `befdc575`: o vazio com a onça usa o `tracejado` e fica centralizado, como no mockup)*
      Da correção `2026-10-28-onca-do-mockup-v3`: `EstadoVazio.tsx` (comentário da prop `ilustracao`) e `estados.test.tsx` dizem que no vazio padrão a
      onça fica "à esquerda", e a tela a mostra centralizada sobre texto à esquerda (a `figure` da `Onca` é `items-center`): alinhar a onça à
      esquerda (muda o que se vê) ou corrigir o comentário e o teste. É a mesma decisão do ramo `tracejado` de `TopoDoVazio`, que nenhuma tela chama
      com ilustração e que só `estados.test.tsx` prova (frontend-reviewer, revisor-geral e conformidade-reviewer, rodadas 1 e 2)
- [ ] Da correção `2026-10-28-onca-do-mockup-v3`: o comentário de `Onca.tsx` (cabeçalho do tipo `Pose`) e o de `Onca.test.tsx` dizem que a `dormindo`
      "ainda não tem lugar no produto"; a 9.7 diz "não entra". Escrever igual, para ninguém ler "ainda" como convite (privacy-guardian e
      conformidade-reviewer, rodada 2)
- [ ] Da correção `2026-10-28-onca-do-mockup-v3`: em `Onca.test.tsx`, conferir que o `<g data-parte="movimento">` das linhas do aceno não tem classe
      (`getAttribute('class')` nulo), e em `Criados.test.tsx` que a onça do vazio mede 120 (test-engineer, rodada 2)
- [ ] Da correção `2026-10-28-onca-do-mockup-v4`: exigir no tipo de `EstadoVazio` que quem passa `ilustracao` passe também
      `variante="tracejado"` (test-engineer e conformidade-reviewer, rodada 1 da v4)
- [ ] Da validação da onça, rodada 3 (m1 e m2): em `EstadoVazio.tsx`, o `justify-center` do `TopoDoVazio` (`:33`) e o da linha do botão (`:56`)
      não fazem nada no `tracejado` (quem centraliza é o `items-center` da caixa); e `e2e/professor-criados.spec.ts:82` mede a onça, o título e o
      botão, mas não o centro de cada linha da descrição (por `Range`)
- [ ] Da validação da onça, rodadas 2 e 3 (m5): o mockup usa `pensando` em dois passos da introdução do professor e `acolhendo` na da
      coordenação. A `acolhendo` não entra (D80, item 3); o `pensando` na introdução do professor pede parecer do conformidade-reviewer, se o
      Joaquim quiser
- [ ] Da correção da onça: o push de um commit só de documento na branch cancela a esteira do commit de código anterior (cancelou três vezes em
      28/10). Fazer o commit de documento depois da esteira, ou a esteira não cancelar quando o commit novo não muda código (dono: Orquestrador)

## Da correção 2026-10-29-contorno-do-campo-de-conversa (o anel de foco da caixa de pedido), fora dela

- [ ] Da correção `2026-10-29-contorno-do-campo-de-conversa`: uma asserção em `apps/web/src/estilos.test.ts` (ou o `outline-style` calculado do
      `textarea` focado, no e2e) de que o `:focus-visible` global fica em `@layer base`; se sair da camada, o `outline-none` da `CaixaPedido` perde e o
      anel duplo volta com o teste de classes verde (test-engineer, rodada 1)
- [ ] Da correção `2026-10-29-contorno-do-campo-de-conversa`: ajustar o comentário de `apps/web/src/estilos.css:337-338` ("nenhuma peça apaga o contorno")
      para "nenhuma peça apaga o contorno sem dar o anel a quem a contém"; e acrescentar a `CaixaPedido` às peças com anel por `focus-within` em
      `docs/interface.md` (test-engineer e frontend-reviewer, rodada 1)
- [ ] Da correção `2026-10-29-contorno-do-campo-de-conversa`: na variante `completa`, ao focar por Tab o seletor de turma ou o enviar, aparecem dois
      anéis (o da moldura e o do controle). Se o Joaquim achar feio na validação, é correção própria, com foto do foco por Tab (test-engineer)
- [ ] Da correção `2026-10-29-contorno-do-campo-de-conversa`: no tema escuro, o anel da `CaixaPedido` fica sempre em `foco`; sobre `.bg-noite` ele daria
      1,99:1. Hoje a caixa só aparece sobre `bg-fundo` e `bg-superficie`; entra na tarefa que puser a caixa sobre `bg-noite` (frontend-reviewer)

## Da X8 (nomes de mercado), tarefa 1.0, fora dela

- [ ] Da tarefa 1.0 da X8: o `travas.md` dizer que a guarda de escopo (`tools/guardas/escopo-dos-repositories.ts`) não varre `tools/`
      (tenancy-guardian, rodada 1, 30/10/2026)
- [ ] Da tarefa 1.0 da X8: em `tools/renomear/aplicar.test.ts`, no caso "quem contorna é acusado", a asserção
      `` `| ${Object.keys(arquivos)[0] ?? ''} | ` `` passaria com string vazia; escrever o nome do arquivo por extenso na tabela dos casos. Hoje toda forma tem
      arquivo, por isso não segura a tarefa (test-engineer, rodada 2, 30/10/2026)

## Da correção 2026-10-30-introducao-da-coordenacao-no-celular, fora dela

- [ ] Da correção `2026-10-30-introducao-da-coordenacao-no-celular`: não há foto da gaveta aberta no celular, porque o clique da vitrine
      (`tools/vitrine/foto.ts`) roda só a 1366 px; quando ele aceitar clique na largura do celular, tirar essa foto (conformidade-reviewer, rodada 1)
- [ ] Da correção `2026-10-30-introducao-da-coordenacao-no-celular`: um caso curto em `apps/web/src/componentes/CascaDaEscola.test.tsx`, igual ao de "de A por ninguém e de
      ninguém para B" mas liberando A de novo, que fixe que a mesma pessoa voltando depois do `undefined` não fecha a gaveta (test-engineer, rodada 2)

## Da X8 (nomes de mercado), tarefa 2.0, fora dela

- [ ] Da tarefa 2.0 da X8: em `tools/renomear/conferir.test.ts`, o caso "o mapa que não existe lança" usa `/ENOENT.*mapas\/9\.json/`, que depende do texto do
      erro do Node; exigir só o caminho do mapa na mensagem (test-engineer, rodada 2, 30/10/2026)
- [ ] Da tarefa 2.0 da X8: `tools/renomear/restos.test.ts`, o caso da árvore real com `timeout: 180_000`, muito acima do tempo real (3,2 s); baixar para
      cerca de 30 s na primeira onda que popular `tools/renomear/mapas/`, quando existir o tempo da varredura com mapas aplicados (infra-guardian, rodada 1)
- [ ] Da tarefa 2.0 da X8: `tools/renomear/conferir.ts:45`, o `maxBuffer` de 1 GiB no `execFileSync('git', …)` é folgado; o limite certo depende do
      tamanho da foto do repositório real (infra-guardian, rodada 1)
- [ ] Da tarefa 2.0 da X8, para o Arquiteto antes da primeira onda: dizer no procedimento de onda do `tasks.md` que a tarefa que renomear `Nota`, `lancadaPor`,
      `Correcao` ou teste citado em `Checagem:` da regra 70 atualiza no mesmo commit a regra 70 e `docs/regulacao.md` (conformidade-reviewer, rodada 1)
- [ ] Da tarefa 2.0 da X8, para o Arquiteto: pôr no `casos.md` as duas fontes a mais que a lista do §5 (`ARQUIVOS_DE_TESTE` e os `workspaces` do
      `package.json`) (revisor-geral, rodada 1)
- [ ] Da tarefa 2.0 da X8: `PADRAO` de `tools/processo/guardioes-por-caminho.ts:37` não é exportado e a trava não o confere; fica para quando alguém mexer
      nesse arquivo (revisor-geral, rodada 1)
- [ ] Da tarefa 2.0 da X8: `tools/guardas/filtros-casam.test.ts` reimplementa `arquivosDoRepositorio()` de `guardas.test.ts`; mover a função para um módulo
      comum (revisor-geral, rodada 1)
- [ ] Da tarefa 2.0 da X8: sem mapa na pasta, o `restos` mostra "o reaplicar não tem o que aplicar" (vem de `lerTodosOsMapas`, `reaplicar.ts`); trocar por
      mensagem neutra, com o teste do `reaplicar` junto (revisor-geral, rodada 1)
- [ ] Da tarefa 2.0 da X8, na primeira onda que renomear um símbolo exportado por dois pacotes: `conferir.ts` troca o nome exportado só pelo `de` e ignora o
      `arquivo` da entrada; dá vermelho falso se dois pacotes exportam o mesmo nome e só um é renomeado (revisor-geral, rodada 1)

## Da correção 2026-10-30-gaveta-aberta-na-alocacao, fora dela

- [ ] Da correção `2026-10-30-gaveta-aberta-na-alocacao`: `esperarASessaoNaBarraDoTopo` (`e2e/__fixtures__/casca.ts`) acha o nome da escola por
      `getByRole('banner').locator('p').first()`, posicional; dar ao nome da escola em `apps/web/src/componentes/CascaDaEscola.tsx` um alvo próprio (`data-testid` ou
      nome acessível) e trocar o seletor (infra-guardian, privacy-guardian, frontend-reviewer e test-engineer, rodada 1)

## Da correção 2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts, fora dela

- [ ] Da correção `2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts`, **para a primeira onda da X8 que mover arquivo de `apps/web`**: `conservarExtensao`
      (`tools/renomear/movimentos.ts`) só conserva o par `.ts`/`.js`. Falta um caso de move com o import sem extensão (`from './x'`, 1988 em `apps/web/src`) e
      com o `.tsx` importado como `./C.js` (`jsx: react-jsx`), que hoje voltaria a sair `./C.tsx`; a condição `novo.endsWith('.ts')` pede o bloco de mutação
      que a derrube sozinha. Nenhum `tsconfig*.json` do repositório tem entrada terminando em `.js`, então o move por `include`/`files` fica sem caso até lá
      (revisor-geral e test-engineer, rodadas 1 e 2)
- [ ] Da correção `2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts`: recusa explícita em `aplicarSimbolosEMovimentos` (`tools/renomear/aplicar.ts`) quando
      `acharDeclaracoes` não acha nada na hora do rename ("a declaração de `de` sumiu depois dos renames anteriores"); hoje a conferência inicial
      (`existencias`) cobre o caso, mas a recusa tornaria o silêncio impossível (revisor-geral, rodada 1)
