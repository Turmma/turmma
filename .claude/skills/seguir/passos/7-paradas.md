## 7. As paradas

Só nestas você para e espera o Joaquim:

1. aprovação do PRD, no terminal do Arquiteto;
2. mudança de desenho ou de critério de aceite (`BLOQUEIO` do Arquiteto);
3. ressalva **crítica ou maior** da validação, e a que toca as regras 10, 20 ou 70 (que nunca é menor):
   corrigir agora ou aceitar, uma a uma. Com todas decididas e alguma aceita,
   **você escreve o aceite na linha do veredito do topo do `validacao.md`**, no formato
   `**Veredito: APROVADA COM RESSALVAS** — ressalvas aceitas por Joaquim em <data>: <motivo>`, e faz o
   commit. É por "aceitas por" nessa linha que o script sai de `validacao-com-ressalvas`;
4. proposta da retrospectiva que muda código de processo, regra, decisão, a lista de um guardião com
   veto (e o resto do arquivo de um revisor com veto, o `mesa-de-revisao.md` e a seção 6 do
   `validador.md`), ou `criar-tasks`, `revisar-tarefa` ou `revisar-spec` (as skills que decidem a marcação de
   guardião), arquivo por arquivo. Também no terminal do Arquiteto;
5. decisão de produto;
6. pouso na `develop`.

E duas que são limite, não decisão: três reprovações seguidas do mesmo revisor na mesma tarefa, e
a terceira falha seguida da mesma tarefa, já com o diagnóstico do Arquiteto aplicado.

**Máquina não é parada** (05/11/2026). Docker parado, terminal sem sessão, socket morto, contêiner caído,
relógio da VM, rede: nada disso está na lista acima, e o time não espera o Joaquim por isso. Na ordem:

1. **Conserte daqui o que dá.** Docker: `powershell.exe -NoProfile -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"`.
   Terminal sem sessão ou morto: reinício (passo 3) e `PEDIDO de retomada`.
2. **Teste que cai por causa da máquina é defeito do teste.** É a `DIVERGÊNCIA` de portão de sempre (passo 6):
   correção na linha, que torna o teste independente da máquina sem afrouxar o que ele prova. Em 05/11/2026 a VM
   passou a contar o tempo de CPU 9% adiantado; o time esperou cinco horas por um `wsl --shutdown`, o reinício não
   consertou, e o conserto do teste levou minutos. Caso de e2e lento demais é o mesmo: encurte ou divida, sem
   rodar de novo esperando a sorte.
3. **Só o que pede a mão do Joaquim** (senha, `sudo`, reiniciar o Windows) vira pergunta, uma vez, pelo `blocked`
   do andar. Ela segura só o que depende dela, e a outra linha segue. Se nada segue, desligue a vigia, como em
   toda parada.

Nunca peça reinício da máquina ou do WSL sem ter esgotado 1 e 2, e nunca escreva a mesma pergunta duas vezes.

**Quatro avisos, que não são parada** (D79, revista em 23/10/2026): a Tech Spec, a lista de tarefas, a
proposta da retrospectiva que só muda skill, papel ou modelo de documento, e a ressalva menor da
validação.

- **A Tech Spec e a lista de tarefas.** O Arquiteto mostra o resumo da Tech Spec no terminal dele e
  segue para a revisão da spec, sem esperar: é o tempo que o Joaquim tem para objetar. Com a lista de
  tarefas pronta, ele envia o `RELATÓRIO`. Você avisa
  (`maestri notify "<func>: tarefas prontas; a construção começa às <agora + 30 min>"`), anota a hora
  em "Agora" e encerra o turno, com a vigia ligada. Na primeira vigia depois da hora, sem palavra do
  Joaquim no seu terminal nem no do Arquiteto, comece a primeira tarefa. Objeção depois disso é
  mudança de desenho (item 2).
- **A proposta da retrospectiva que só muda skill, papel ou modelo de documento**, salvo as do item 4
  acima. O Arquiteto mostra no terminal dele, com a hora, e aplica 30 minutos depois, sem objeção do Joaquim. Com a objeção, a
  proposta volta a ser confirmação, arquivo por arquivo. Você não tem o que fazer além de registrar.
- **A ressalva menor da validação.** Não segura o pouso: no fechamento você leva cada uma ao
  `TODO.md`, com dono e data, e registra em "O que decidi sem perguntar". Se o veredito foi APROVADA COM
  RESSALVAS e **todas** as ressalvas são menores e nenhuma toca as regras 10, 20 ou 70, escreva você o
  aceite na linha do veredito (`ressalvas aceitas por Orquestrador (aviso da D79) em <data>: <motivo>`);
  qualquer maior ou crítico no meio faz a parada do item 3.

Ao parar, a pergunta fica em três lugares: no `estado.md` do andar, na seção "Esperando o Joaquim"
(é o que uma sessão nova lê para saber que há uma parada aberta); no status do andar; e **na sua
resposta, aqui no terminal**, que é onde ele responde.

```bash
maestri floor status "<a pergunta, em uma linha>" --state blocked --floor "<andar>"
maestri routine disable "Vigia do processo"
```

A entrada, no `estado.md` e na sua resposta:

```
## <data e hora> — <id> <tarefa ou fase>
Decisão: <a pergunta, em uma frase>
Contexto: <até três linhas, com o arquivo a abrir>
Opções: <a> | <b>
Recomendo: <qual e por quê, em uma linha>
```

O estado `blocked` já notifica o Joaquim; não mande `maestri notify` junto. Notificação avulsa só
no fim da funcionalidade, e em parada sem andar. Depois de parar, encerre o turno. Com a resposta
dele, marque a entrada como respondida, com a decisão, religue a vigia e siga. Depois de ele
destravar o limite das três reprovações, a contagem daquela tarefa recomeça: acrescente em
`.processo/ordens/rodadas.md`, no andar, a linha `<documento> | destravado | <revisor> | depois da
<n>ª rodada dele`, que é o que a Mesa lê para contar.

**A parada segura só o que depende dela** (D78). Vale para as paradas 1, 2 e 5 abertas durante a construção,
com tarefa pendente. Não vale para a ressalva da validação, a retrospectiva, o pouso, o conflito de
merge nem os dois limites, que são da própria tarefa.

- **A pergunta que você se faz:** a tarefa que vai partir (a do quadro) muda em alguma das opções, ou
  depende de tarefa ou de seção da Tech Spec que muda? Confira no documento dela e na tabela de
  dependências do `tasks.md`. Na dúvida, depende, e você espera como sempre
- **Não depende:** registre a parada nos três lugares, deixe a vigia ligada e siga o ciclo dessa
  tarefa (passo 6). Na entrada do `estado.md`, diga qual tarefa seguiu e por que não depende. A
  pergunta continua aberta e continua do Joaquim: você não escolhe opção nem adianta nada que dependa
  dela. Terminada a tarefa, refaça a pergunta para a seguinte
- **Documento muda no andar da spec, com as linhas correndo.** A resposta do Joaquim que chega ao
  `Arquiteto` ele aplica e commita lá, e avisa você com `/seguir RELATÓRIO de Arquiteto`; a que chega
  a você vira `PEDIDO` a ele na hora. Marque a entrada como respondida: cada linha recebe o commit
  na partida seguinte
- **Não reinicie o `Arquiteto` com a pergunta aberta no terminal dele:** é a sessão dele que guarda a
  pergunta e recebe a resposta. Escalada ou divergência da tarefa em curso que precise dele espera a
  resposta do Joaquim; diga isso na entrada da parada
- **O status do andar** fica `blocked` enquanto a pergunta estiver aberta, mesmo com tarefa correndo:
  é ele que avisa o Joaquim
