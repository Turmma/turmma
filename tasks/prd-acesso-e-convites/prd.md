# PRD — A equipe e o aluno entram sem depender de ninguém

**Status:** aprovado (03/11/2026, Joaquim), como parte do PRD do F2 (`tasks/prd-onboarding-por-convite/prd.md`); separado
dele no corte de 03/11/2026, por escolha do Joaquim, sem mudar requisito. Os números dos RF são os do F2
**Funcionalidade do roadmap:** F2c — `acesso-e-convites`
**Depende de:** F2 (`onboarding-por-convite`: as planilhas, o motor de importação e o `desativar` que encerra os vínculos), A1

## 1. Problema

Com as planilhas do F2, a escola entra inteira, mas o convite do professor ainda é copiado um a um, quem da equipe
esquece a senha não volta sozinho, o aluno que esquece a senha não volta, e o de escola com Google ou Microsoft é
recusado (D48).

## 2. Objetivo

O professor recebe o convite por e-mail, a equipe redefine a senha sozinha, e o aluno entra pela conta da escola ou
volta com uma senha provisória, sem ninguém cadastrado um a um.

## 3. Fora de escopo

- E-mail a aluno (regra 20, item 2) ou a responsável (fase posterior)
- O convite da primeira coordenação (A0b) e a senha do operador
- Classroom (D48): sem fase até uma escola pedir
- **Não há IA**

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Coordenador | Enviar convites por e-mail; gerar senha provisória de aluno; "esqueci a senha" | Ver a senha do aluno; ligar conta da escola a aluno |
| Professor | Gerar senha provisória para aluno de turma com vínculo confirmado; "esqueci a senha" | Alcançar aluno de outra turma |
| Aluno | Reivindicar o nome com a conta da escola; ligar a conta depois de entrar com matrícula; trocar a senha provisória | Entrar sem aprovação; ligar conta de outra pessoa |

## 5. Requisitos funcionais

| # | Requisito | Como se prova |
|---|---|---|
| RF11 | **Convite por e-mail**: "Enviar convites" manda aos professores sem aceite ou aos selecionados, com o token da A1 (uso único, 7 dias, revogável). O e-mail traz a escola e o link, nunca nome de aluno; cada professor mostra o estado (na fila, enviado, falhou), e o envio não prende a tela; enviar e reenviar refazem o token; o link copiável continua | 40 convites num clique; enviar invalida o anterior |
| RF12 | **Esqueci a senha** (professor e coordenação): link por e-mail, uso único, 1 hora; resposta igual exista ou não a conta; redefinir encerra as sessões; o segundo fator continua | E-mail inexistente e existente respondem igual |
| RF13 | **Senha provisória**: coordenação, ou professor com vínculo confirmado na turma, gera para aluno aprovado uma senha mostrada uma vez, válida por 24 horas, que só serve para o aluno criar a nova antes de qualquer tela, onde ele vê as provisórias geradas antes e se foram usadas. A antiga para de valer na geração | Aluno de outra turma ou escola responde igual a inexistente; a provisória não entra duas vezes |
| RF14 | **Conta da escola do aluno**: pelo link da sala, ele entra com a conta de um domínio liberado, escolhe o nome, informa a matrícula, e a aprovação liga a conta; o aluno já aprovado liga a sua em "Eu". Uma conta por aluno; conta ligada a outro é recusada sem dizer a quem; guarda-se só o identificador opaco | Antes da aprovação, recusada; depois, entra; o banco não tem e-mail nem foto do provedor |
| RF16 | Tudo alcança só a escola ativa e o ano em curso; id de outra escola responde igual a inexistente (regra 10) | Isolamento por módulo novo |
| RF17 | Ficam na auditoria, com autor e data: envio de convite, senha redefinida, e-mail verificado, senha provisória gerada e usada, conta ligada, e e-mail do professor corrigido; nenhum registro traz nome, matrícula ou e-mail. O arquivo do titular passa a trazer os atos de outra pessoa sobre ele, só com o papel de quem fez (D85, com as quatro ações da F2) | Um registro por ação; a ação aparece no arquivo do alvo, sem o autor |
| RF18 | O e2e prova a entrada: convites pelo e-mail → professor aceita; esqueci → redefinir; um aluno reivindica com a conta da escola → aprovação; provisória → troca (regra 40) | e2e em `chromebook` e `celular` |

## 6. Regras de negócio

- A senha provisória não se vê de novo e não vira a senha do aluno
- E-mail só vai à equipe da escola, sem dado de aluno
- Conta da escola do aluno só se liga com aprovação humana (D4)

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| E-mail que volta | "Falhou"; corrigir e reenviar, ou copiar o link. Corrigir o e-mail mantém o professor, as turmas e as aulas dele, e vale só para quem nunca entrou |
| Aluno com conta da escola pede senha provisória | A tela diz que ele entra pela conta |
| Conta de link copiado aceita convite de outra escola | Só com o e-mail verificado |
| Professor cadastrado pela grade ou pela planilha (F2) | Entra no "Enviar" seguinte |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Estado do envio do convite (data, estado) | professor | mostrar se chegou | até aceite, revogação ou vencimento | sim (revisão do F2) |
| E-mail e texto enviados ao provedor de e-mail | professor, coordenador | entregar convite e redefinição | contrato do suboperador | sim; o provedor entra como suboperador antes da primeira escola real |
| Pedido de redefinição (hash do token, validade, uso) | professor, coordenador | redefinir a senha | 30 dias após uso ou vencimento | sim (revisão do F2) |
| Senha provisória (hash, validade, quem gerou) | aluno, quem gerou | voltar a entrar sem e-mail | hash sai no uso ou vencimento; autor na auditoria | sim (revisão do F2) |
| Identificador opaco da conta da escola | aluno | login (D48) | enquanto houver vínculo | sim |

## 8b. Risco regulatório

Sem IA no caminho. Valem a regra 20 (aluno sem e-mail, e-mail do convite sem dado de aluno) e a D4 (conta da
escola ligada só com aprovação humana).

## 9. Métricas

- Convites que falharam, por escola
- Senhas provisórias por semana por escola

## 10. Perguntas em aberto

1. O provedor de e-mail, onde processa e o contrato (suboperador); Mailpit no compose
2. O formato da senha provisória que se dita em sala sem confusão (sem 0/O, 1/l): respondido na Tech Spec
