# PRD — A escola inteira entra de uma vez

**Status:** aprovado (03/11/2026, Joaquim)
**Funcionalidade do roadmap:** F2 — `onboarding-por-convite`, no recorte de 03/11/2026: a visão Semana saiu
para a F2b (`semana-do-professor`), e o Classroom ficou sem fase até uma escola pedir
**Depende de:** F1, A1

## 1. Problema

A Na A1 a coordenadora cria cada turma, sobe a lista turma a turma, cadastra cada professor, copia cada
convite e aloca à mão. Com 900 alunos, 30 turmas e 40 professores, é um dia de cliques, e
a grade horária, de onde a alocação deveria sair, não existe (D3 revista). Aluno que esquece a senha não volta, e
o de escola com Google ou Microsoft é recusado (D48).

## 2. Objetivo

A coordenadora monta a escola com quatro planilhas — alunos, professores, grade e calendário —, o professor
recebe o convite por e-mail e confirma o que a grade definiu, e o aluno entra pela conta da escola ou volta com
uma senha provisória, sem ninguém cadastrado um a um.

## 3. Fora de escopo

- A visão Semana, a `Aula` concreta e o "seu dia e sua semana": F2b, com a decisão em aberto P12
- Classroom (D48): sem fase até uma escola pedir
- Arquivo de programa de horário (aSc, Urânia): só o nosso modelo, CSV e XLSX
- Grade A/B, quinzenal ou que muda por data no meio do ano: reimportar substitui
- Bimestres no calendário: F17
- Professor criar ou mover aula (regra 60, item 8)
- E-mail a aluno (regra 20, item 2) ou a responsável (fase posterior)
- O convite da primeira coordenação (A0b) e a senha do operador
- Eliminar pessoa: é pedido do titular (F3); desligar aqui só desativa
- **Não há IA**

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Coordenador | Subir as quatro planilhas com prévia; marcar transferência e desligamento; enviar convites por e-mail; gerar senha provisória de aluno; ver grade e calendário | Ver a senha do aluno; confirmar vínculo pelo professor; ligar conta da escola a aluno |
| Professor | Confirmar ou contestar o vínculo da grade (A1); gerar senha provisória para aluno de turma com vínculo confirmado; "esqueci a senha"; ver a grade das turmas dele | Subir planilha; mudar grade ou calendário; alcançar aluno de outra turma |
| Aluno | Reivindicar o nome com a conta da escola; ligar a conta depois de entrar com matrícula; trocar a senha provisória | Entrar sem aprovação; ligar conta de outra pessoa |

## 5. Requisitos funcionais

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | Escola ganha o lugar **Grade e calendário**, ao lado de Turmas, Professores e Material: os modelos de planilha para baixar, a grade por turma (dias × horários) e o calendário do ano em curso | O modelo baixado e preenchido entra sem erro |
| RF2 | Toda planilha sobe em CSV ou XLSX (primeira aba) e passa por **prévia**: cada linha classificada, o erro na linha, o efeito em contagem. Com erro, nada grava | Três linhas erradas: a prévia aponta as três e o banco não muda |
| RF3 | A **planilha de alunos** traz turma, nome e matrícula, até 3.000 linhas. "8ºA", "8º A", "8A" e "8a" são a mesma turma; turma inexistente vira "turma nova" quando a série sai do nome (6º–9º Fundamental, 1º–3º Médio), senão é erro | "8 A" e "8ºA" na mesma turma; "Turma Azul" é erro |
| RF4 | Reimportar **atualiza sem duplicar**, pela matrícula: "entra", "já existe", "nome corrigido", "muda de turma", "fora da planilha". Nome corrigido atualiza; **transferir e desligar só com a marca da coordenação na prévia** | Mesma planilha duas vezes não muda nada; ausente segue ativo até ser marcado |
| RF5 | Transferir encerra o vínculo antigo e abre o novo no mesmo instante; o trabalho feito fica na turma antiga. Desligar encerra os vínculos e desativa o acesso (regra 20, item 18). Nome não aprovado que sai deixa a lista, e o pedido pendente é encerrado | Transferido alcança só a nova; desligado não entra |
| RF6 | A **planilha de professores** traz nome e e-mail, até 300 linhas; e-mail repetido não duplica; conta de outra escola cliente ganha o segundo vínculo no aceite (A1); ausente na reimportação só desliga marcado | Mesmo e-mail duas vezes, uma pessoa |
| RF7 | A **planilha de grade** traz, por aula, turma, disciplina, nome e e-mail do professor, dia, início, fim e sala opcional. Turma, disciplina e professor inexistentes aparecem como "novo" e nascem ao gravar. Horário impossível é erro; professor em duas turmas, ou turma com duas aulas, no mesmo horário é **aviso** (aula conjunta e turma dividida existem) | Professor em duas turmas às 8h: aviso, grava; aula das 9h às 8h: erro |
| RF8 | **Gravar a grade gera a alocação**: turma × disciplina × professor sem vínculo vira vínculo pendente, e o professor confirma ou contesta (A1). Confirmado não muda | Sem confirmar, o professor não alcança a turma |
| RF9 | Reimportar a grade a substitui. Vínculo que perdeu as aulas aparece "sai da grade" e só encerra marcado; o criado à mão sem aula fica | Grade sem o professor X: o vínculo dele segue até a marca |
| RF10 | A **planilha de calendário** traz início, fim, tipo (feriado, recesso, evento) e descrição; data fora do ano letivo é erro; reimportar substitui, com a diferença na prévia | Feriado de 2027 no ano 2026: erro |
| RF11 | **Convite por e-mail**: "Enviar convites" manda, de uma vez, aos professores sem aceite ou aos selecionados, com o token da A1 (uso único, 7 dias, revogável). O e-mail traz a escola e o link, nunca nome de aluno; cada professor mostra o estado (na fila, enviado, falhou); reenviar refaz o token; o link copiável continua | 40 convites num clique; reenviar invalida o anterior |
| RF12 | **Esqueci a senha** (professor e coordenação): link por e-mail, uso único, 1 hora; resposta igual exista ou não a conta; redefinir encerra as sessões; o segundo fator continua | E-mail inexistente e existente respondem igual |
| RF13 | **Senha provisória**: coordenação, ou professor com vínculo confirmado na turma, gera para aluno aprovado uma senha mostrada uma vez, válida por 24 horas, que só serve para o aluno criar a nova antes de qualquer tela. A antiga para de valer na geração | Aluno de outra turma ou escola responde igual a inexistente; a provisória não entra duas vezes |
| RF14 | **Conta da escola do aluno**: pelo link da sala, ele entra com a conta de um domínio liberado, escolhe o nome, informa a matrícula, e a aprovação liga a conta; o aluno já aprovado liga a sua em "Eu". Uma conta por aluno; conta ligada a outro é recusada sem dizer a quem; guarda-se só o identificador opaco | Antes da aprovação, recusada; depois, entra; o banco não tem e-mail nem foto do provedor |
| RF15 | A prévia de 3.000 linhas sai em até 10 segundos; gravar e enviar e-mail não prendem a tela, que diz quando terminou | Teste de carga com 3.000 linhas |
| RF16 | Tudo alcança só a escola ativa e o ano em curso; id de outra escola responde igual a inexistente (regra 10) | Isolamento por módulo novo |
| RF17 | Ficam na auditoria, com autor e data: planilha gravada (tipo e contagens), transferência, desligamento, envio de convite, senha provisória e conta ligada; nenhum registro traz nome ou matrícula | Um registro por ação |
| RF18 | O e2e prova a escola entrando: escola vazia → quatro planilhas, uma suja → convites → professor confirma o que a grade definiu → um aluno reivindica com a conta da escola e outro com matrícula → aprovação (regra 40) | e2e em `chromebook` |

## 6. Regras de negócio

- O vínculo vem da escola, pela grade ou à mão, e só dá acesso confirmado (regra 60, item 8a)
- A matrícula, única por escola, identifica o aluno na reimportação (regra 60, item 6)
- Grade, alocação e calendário são do ano letivo; o ano novo recebe planilhas novas
- Nenhuma reimportação remove, transfere ou desliga sem a marca da coordenação
- Desligar não é eliminar: o dado segue a retenção do F3
- A senha provisória não se vê de novo e não vira a senha do aluno
- E-mail só vai à equipe da escola, sem dado de aluno

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Dois alunos com o mesmo nome na turma | A matrícula os separa |
| Transferido com pedido pendente | Pedido encerrado; o nome vai livre para a turma nova |
| Matrícula que o Excel virou número ("1,23E+05", zeros perdidos) | XLSX lê como texto; no CSV, notação científica é erro na linha |
| Grade com professor não convidado | Nasce cadastrado e entra no envio seguinte |
| Professor discorda da alocação | Contesta; reimportar não reabre o contestado |
| Professor em duas escolas clientes | Uma conta, um vínculo e uma grade por escola |
| E-mail que volta | "Falhou"; corrigir e reenviar, ou copiar o link |
| Aluno com conta da escola pede senha provisória | A tela diz que ele entra pela conta da escola |
| Grade subida com o ano `planejado` | Vale quando o ano entrar em curso |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Nome, matrícula e vínculo do aluno, da planilha | aluno | identificar na turma | A1 e F3 | sim |
| Nome e e-mail do professor, da planilha | professor | convidar e autenticar | conta global | sim |
| Aula da grade (turma, disciplina, professor, dia, horário, sala) | professor | derivar o vínculo e a semana (F2b) | ano letivo + prazo de estrutura do F3 | não: entra |
| Estado do envio do convite (data, estado, id no provedor) | professor | mostrar se chegou | até aceite, revogação ou vencimento | não: entra |
| E-mail e texto enviados ao provedor de e-mail | professor, coordenador | entregar convite e redefinição | contrato do suboperador | não: provedor entra como suboperador |
| Pedido de redefinição (hash do token, validade, uso) | professor, coordenador | redefinir a senha | 30 dias após uso ou vencimento | não: entra |
| Senha provisória (hash, validade, quem gerou) | aluno, quem gerou | voltar a entrar sem e-mail | hash sai no uso ou vencimento; autor na auditoria | não: entra |
| Identificador opaco da conta da escola | aluno | login (D48) | enquanto houver vínculo | sim |
| Arquivo da planilha | aluno, professor | importar | não é guardado | — |

## 8b. Risco regulatório

Sem IA no caminho. Valem a regra 20 (aluno sem e-mail, e-mail do convite sem dado de aluno) e a D4 (conta da
escola ligada só com aprovação humana).

## 9. Métricas

- Dias até 90% dos professores com vínculo confirmado
- Linhas com erro na primeira tentativa, e tentativas até gravar
- Convites que falharam, por escola
- Senhas provisórias por semana por escola

## 10. Perguntas em aberto

1. O provedor de e-mail, onde processa e o contrato (suboperador); Mailpit no compose
2. A planilha grande grava em fila ou na requisição, e o limite por escola (regra 80, item 3)
3. O formato da senha provisória que se dita em sala sem confusão (sem 0/O, 1/l)
4. Se a lista por turma da A1 passa a seguir a reimportação do RF4
