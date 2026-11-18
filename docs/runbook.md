# Runbook

> O que fazer quando um alerta dispara. Quem opera é uma pessoa só (D26), então cada
> entrada precisa ser seguível às 7h40 de uma segunda, sem pensar muito.
>
> **Regra:** alerta novo entra em produção junto com a sua entrada aqui (regra 80, item 10).
> Alerta sem entrada é alerta que ninguém sabe tratar.

Os alertas nascem no F0, locais: as regras ficam em `infra/grafana/alertas/`, disparam no Grafana
da observabilidade local (`http://127.0.0.1:53300`, pasta "Educa.ia alertas") e ainda não chegam
ao celular, o que fica para o staging (D31). Cada arquivo de regra tem aqui a entrada com o mesmo
nome, e o teste `tools/guardas/alerta-tem-runbook.test.ts` reprova a regra que entrar sem ela.
As entradas marcadas *a preencher* são o esqueleto dos alertas previstos em `docs/infra.md`
seção 7, para serem escritas quando cada um for criado.

---

## Formato de cada entrada

```
## <nome do alerta>

Dispara quando: <condição exata e limiar>
Impacto: <quem sente, e o que vê>
Primeiro olhar: <painel ou comando>
Causas prováveis:
  1. <causa> → <o que fazer>
  2. <causa> → <o que fazer>
Se nada disso resolver: <como degradar ou avisar as escolas>
Depois: <o que registrar, e se vira tarefa>
```

---

## Job interativo esperando

**Dispara quando:** o job mais antigo de uma escola, na fila `interativa` (o turno do Tutor) ou na `ferramenta` (a ferramenta,
a proposta e o artefato), espera mais de 30 s, por 1 min seguido
(`max by (fila, escola_id) (job_espera_mais_antiga_s{fila=~"interativa|ferramenta"}) > 30`, regra
`infra/grafana/alertas/job-interativo-esperando.yaml`). Na prática, um job parado há mais de uns
90 s. O alerta traz o `escola_id` e a `fila`: a `ferramenta` tem a vaga dela (`VAGAS_ESCOLA_FERRAMENTA`, 4) e a `interativa` a dela
(`VAGAS_ESCOLA_INTERATIVA`, 10), e o "Vagas em uso" do painel se lê na fila do alerta. Uma queda curta do Redis de fila deixa o job até ~30 s a mais
esperando depois que ele volta (a reserva vence e o despachante publica de novo): isso deixa a
regra pendente, e só dispara se a espera continuar acima de 30 s pelo minuto inteiro.

**Impacto:** professora ou aluno daquela escola pediu uma ferramenta e ela não começou. Várias
escolas disparando juntas é o sistema; uma só é algo daquela escola.

**Primeiro olhar:** painel "Fundação — rota, fila e escola", linha "Filas": "Espera do job mais
antigo", "Vagas em uso", "Jobs que chegaram sem vaga" e "Jobs em stalled", na escola do alerta.
Depois `docker compose ps worker-interativo-1 worker-interativo-2 worker-ia-1 worker-ia-2 despachante-1 despachante-2 redis-fila`
e `docker compose logs --since 10m worker-interativo-1 worker-interativo-2 worker-ia-1 worker-ia-2 despachante-1`. O alerta da `ferramenta`
e o da `interativa` do Tutor são do `worker-ia`: olhe-o primeiro.

**Causas prováveis:**
1. Worker interativo parado ou reiniciando em laço (sem `healthy` no `ps`) →
   `docker compose up -d worker-interativo-1 worker-interativo-2`. Se volta a cair, o log dele diz
   por quê (`worker.redis_indisponivel`, `worker.fila_com_erro`). O job não se perde: está em
   `job_registro` e começa quando o worker volta.
   A fila `ferramenta` não é desse worker: quem a consome é o `worker-ia` (`docker compose up -d worker-ia-1 worker-ia-2`; o log dele diz
   `ia.execucao.*` com o `execucaoId`, a escola e o código). A execução que ficou `rodando` com o worker morto é encerrada com `EXECUCAO_INTERROMPIDA`
   pela reentrega do job (uns 15 s depois) ou, no máximo, pela varredura do `main-worker` (a cada 60 s, a `rodando` de mais de 300 s), e quem pediu tenta de novo; as duas deixam
   uma linha estimada em `consumo_ia` (o consumo a mais, nunca a menos): para conciliar o custo com a fatura do provedor, ela se separa por `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'` (`tentativas` 1 e os dois tetos da tarefa nos tokens são hipótese, e não o que o provedor cobrou). A `pendente` sem job vivo também é encerrada pela varredura.
2. Só esta escola, com "Vagas em uso" no teto dela (`VAGAS_ESCOLA_INTERATIVA` ou `VAGAS_ESCOLA_FERRAMENTA`, conforme a fila, ou as vagas da
   escola em `configuracao_operacional_escola`) → a escola espera pelos próprios jobs longos, e as
   outras não sentem. Com "Jobs em stalled" subindo, um job travou: siga o `jobId` no log do worker.
   Um job que rodou de novo aparece com mais de um `job.iniciado` do mesmo `jobId` (a `tentativa`
   sobe na retentativa e se repete no stalled); é esperado, porque a entrega é pelo menos uma vez (D49).
   Aumentar as vagas da escola é decisão, não correção de madrugada: registre.
3. Redis de fila fora (`redis_disponivel{instancia="fila"}` em 0, `despachante.vaga_indisponivel`
   no log) → `docker compose up -d redis-fila`. Com ele de volta, o despachante publica o que ficou
   em até ~30 s, e a reconciliação republica o que sumiu do BullMQ em até ~2 min.
4. Os dois despachantes parados → `docker compose up -d despachante-1 despachante-2`. Sem
   despachante, ninguém mede a espera: o último valor fica congelado no Prometheus por até 5 min,
   e depois a série some e a regra volta a normal **sem o job ter começado**. Confira no painel
   que a espera zerou, e não só sumiu.
5. O `worker-ia` parado pela D62 (sem `healthy` no `ps`, sem consumir, **e sem reiniciar em laço**: ele sobe e espera) → o log dele traz `ia.soberania_na_subida_recusada` (o
   cadastro do provedor não cobre a D62) ou `ia.soberania_na_subida_sem_banco` (o banco não respondeu na subida); veja "A D62 na subida" mais abaixo. Só vale com provedor externo.

**Variável nova no ambiente de produção (deploy da `ferramenta`):** o `infra/compose.yml` lê `VAGAS_ESCOLA_FERRAMENTA` com `:?`, então o `despachante` e os
workers **não sobem** sem ela, e o deploy pela `main` (D31) para no compose. Antes do primeiro deploy com a fila `ferramenta`, ponha no `.env` da VPS
(D82) `VAGAS_ESCOLA_FERRAMENTA=4` e confira se `VAGAS_ESCOLA_INTERATIVA` está em 10: o deploy não troca o `.env` sozinho (é o mesmo caso dos 6.000 do
login, na seção do rate limit mais abaixo). Deploy fora do horário letivo.

**Variável nova no ambiente de produção (limite de tokens, 49.0):** o `infra/compose.yml` lê `LLM_TOKENS_POR_MINUTO` com `:?` no `api` e no `worker-ia`, e a configuração
**não sobe** fora do `AMBIENTE=local` sem ela. Antes do pouso na `main` que a traz, ponha no `.env` da VPS o que o contrato com o provedor dá em tokens por minuto
(o do `.env.example`, 2.500.000, é só o exemplo do desenvolvimento): sem a linha, o deploy automático para na interpolação do compose, e o `worker-ia` fica no que estava. O deploy não troca o `.env` sozinho.

**Variável nova no ambiente de produção (adaptador falso, 11.0):** o `infra/compose.yml` lê `IA_LATENCIA_FALSA_MS_PADRAO`, `IA_TOKENS_FALSOS_ENTRADA` e `IA_TOKENS_FALSOS_SAIDA` com `:?`
nos dois `worker-ia`, então eles **não sobem** sem as três, e o deploy pela `main` (D31) para na interpolação do compose, com a versão nova derrubada e a anterior no que estava (inclusive uma correção urgente). Antes do pouso na
`main` que as traz, ponha no `.env` da VPS (D82) `IA_LATENCIA_FALSA_MS_PADRAO=0`, `IA_TOKENS_FALSOS_ENTRADA=0` e `IA_TOKENS_FALSOS_SAIDA=0` (zero é ausente: em produção o adaptador é o do provedor, que nunca as lê; elas só
valem na carga, com `IA_ADAPTADOR=falso`). O deploy não troca o `.env` sozinho. Deploy fora do horário letivo.

**Se nada disso resolver:** reinicie um worker por vez (`docker compose restart worker-interativo-1`,
depois o 2), que espera os jobs em andamento por até 20 s (a graça) e não perde nenhum: o que passa dela e ainda tem tentativa fica
`ativo` e outra réplica o retoma; só a última tentativa termina `EXECUCAO_INTERROMPIDA` (veja "Job que falhou de vez"). Continuando, avise a
coordenação da escola afetada (seção "Como avisar as escolas") de que as ferramentas estão lentas.

**Depois:** registre no `TODO.md` a escola (id), o horário, a causa e quanto o job esperou, pelo
`jobId` em `job_registro` (só ids). Causa nova vira tarefa com teste que a reproduz.

## Job que falhou de vez

**Dispara quando:** há job de um tipo que terminou `falhou` e ainda está em `job_registro`, por 1 min
(`max by (tipo) (job_falhos) > 0`, regra `infra/grafana/alertas/job-falhou-de-vez.yaml`; X5, tarefa 44.0). `falhou` é o job que
esgotou as tentativas (5, com recuo) ou que falhou de forma definitiva. O despachante mede a cada 5 s e o alerta traz o `tipo`, nunca
a escola nem o `dados`. A linha `falhou` fica 30 dias em `job_registro` (o `concluido` sai em 7) e o expurgo a leva; a de `titular.*`
fica até a ação do operador. **O alerta não zera quando alguém olha**: fica aceso enquanto houver linha do tipo, e a lista de falhos
está no "Primeiro olhar". Reprocessar e descartar têm comando (3.0 da ingestão do material, 46.0 da X5): veja "Reprocessar ou descartar um job que falhou" abaixo.

**Impacto:** depende do tipo. `titular.montar-arquivo` e `titular.eliminar`: o pedido de um titular (LGPD, art. 18) não andou, e o job foi
enfileirado uma vez só, então ninguém vai tentar de novo sozinho. `ia.*`: a ferramenta ou o tutor da escola não entregou o que a pessoa
pediu. `retencao.*`: o expurgo de dado de uma escola não terminou. `sistema.*`: a rotina volta na próxima rodada agendada.

**Primeiro olhar:** quais são, por tipo e escola, só com ids, códigos e datas (nunca `dados`):
`docker compose exec postgres psql -U educa -c "select id, escola_id, tipo, codigo_falha, concluido_em from job_registro where estado = 'falhou' order by concluido_em desc limit 50"`.
O log do worker, pelo `jobId`, traz as tentativas (`job.tentativa_falhou`, com o código e o erro resumido) e o fim (`job.falhou`).
No painel "Fundação — rota, fila e escola": "Jobs que falharam de vez, por tipo".

**Causas prováveis:**
1. Dependência fora durante as cinco tentativas (storage, provedor de IA, Redis de fila): o `codigo_falha` repete em vários jobs do mesmo
   tipo e a hora é a mesma → com a dependência de volta, o próximo job do tipo passa. O falho que ficou não é refeito sozinho: registre-o
   (veja "Depois") e, no `titular.*`, abra correção com o id do pedido.
2. Defeito de código num tipo (o mesmo `codigo_falha` em todo job dele, de várias escolas, depois de um deploy) → volte o código
   (`docker compose up -d` com a imagem anterior) e abra correção com o tipo, o código e o `jobId`.
3. Defeito de uma escola só (um dado que o processador não tratou) → siga o `jobId` no log do worker; abra correção com o `sqlstate`
   ou o código, nunca com a mensagem do Postgres, que pode citar o texto da linha.
4. A série não some depois dos 30 dias → o expurgo de jobs não rodou (veja "Rotina do sistema sem rodar"), ou a linha é de `titular.*`,
   que não sai por prazo.
5. O alerta volta a normal sem ninguém ter tratado o job, com o Postgres de pé → a consulta dos falhos falhou (por exemplo, estourou o
   `statement_timeout`): a medição tira só `job.falhos` da exportação, e a regra de 5xx não vê isso. Procure o aviso
   `despachante.medicao_indisponivel` no log (`docker compose logs --since 10m despachante-1 despachante-2`) e confira a lista do
   "Primeiro olhar" direto no banco, que é a verdade; abra correção com o erro resumido do aviso.
6. `codigo_falha = TEMPO_ESGOTADO` → a tentativa passou do `prazoMs` do tipo (`packages/shared/src/system/job-definitions.ts`) e o
   worker a cortou: aborta o `sinal`, libera a vaga da escola na hora (também quando o job vai tentar de novo) e só marca `falhou` na
   última tentativa. O log tem `job.tempo_esgotado` (`jobId`, `tentativa`, `prazoMs`, nunca o `dados`). **O corte não mata o
   processador que ignora o `sinal`:** ele pode seguir rodando depois, e só a idempotência (D49) impede o efeito de repetir. Muitos
   jobs do mesmo tipo e a mesma hora → dependência lenta (storage, banco, provedor); um tipo só, depois de um deploy → o trabalho
   passou a durar mais que o prazo: abra correção com a medição, nunca suba o `prazoMs` sem ela.
7. `codigo_falha = EXECUCAO_INTERROMPIDA` → o worker recebeu SIGTERM (deploy, `restart`) e a **última** tentativa do job
   ainda rodava quando a graça de 20 s acabou. A linha foi gravada na escola dela e a vaga liberada; outra réplica, ao retomar o job
   pelo stalled, vê a linha final e não o executa. Job com tentativa sobrando não chega aqui: fica `ativo` e é retomado. Queda sem SIGTERM (`kill -9`, host que caiu) também não grava este código: a linha fica `ativo` e o job volta pelo stalled. Foi no
   deploy, em horário letivo → o deploy fora do horário é regra (regra 80, item 9); registre o tipo e a escola (veja "Depois").

**Se nada disso resolver:** não apague a linha à mão nem mude o `estado` por `update`: a linha é o rastro de que o job não terminou, e quem a
reprocessa ou a descarta, com chamado e auditoria, é o comando da seção "Reprocessar ou descartar um job que falhou". Escale ao dono do produto e, se o tipo é `titular.*` ou `ia.*`, avise a coordenação da
escola de que o pedido ou a ferramenta atrasou, sem mandar nome nem conteúdo por mensagem.

**Depois:** registre no `TODO.md` o tipo, o `jobId`, a escola (id), o `codigo_falha` e a data, só com ids. Causa nova vira tarefa com
teste que a reproduz.

## Reprocessar ou descartar um job que falhou

Os três comandos rodam com `OPERADOR=<pessoa da equipe>` (um operador ativo) e só tocam job que está `falhou`. Nenhum imprime nem guarda o
`dados` do job: ele pode trazer o id de um material ou de um pedido.

```
OPERADOR=<pessoa> npm run -s ops:jobs-que-falharam
OPERADOR=<pessoa> npm run -s ops:reprocessar-job -- <id do job> --chamado <n>
OPERADOR=<pessoa> npm run -s ops:descartar-job -- <id do job> --chamado <n>
```

- **`ops:jobs-que-falharam`** lista até 200, dos mais recentes: id, escola, tipo, fila, código da falha e data. É a lista do "Primeiro olhar" de
  "Job que falhou de vez", sem precisar do `psql`.
- **`ops:reprocessar-job`** volta o job a `aguardando`: tira do Redis de fila a cópia `failed` dele (sem isso a fila ignoraria a publicação do mesmo
  id) e o despachante o publica de novo. Grava `job.reprocessado` na auditoria da escola, com o número do chamado. **Recusa** `ia.*`, `titular.*`
  (o pedido do titular foi enfileirado uma vez só e tem o caminho dele) e `material.extrair-pdf`: no PDF, "Tentar de novo é envio novo", porque o
  objeto já saiu do storage e quem tenta de novo é a coordenação, enviando o arquivo outra vez. Antes de reprocessar, confira que a causa saiu (o
  storage de volta, o código corrigido): o job que volta e falha de novo só repete o alerta. **`email.enviar-convite` manda de novo um e-mail para fora da
  casa**: confira o convite (se ainda vale, e para quem foi) antes de reprocessar, mesmo que o worker recuse o convite revogado.
- **`ops:reclassificar-escola`** (`OPERADOR=<pessoa> npm run -s ops:reclassificar-escola -- --escola <id da escola> --chamado <n>`) refaz a classificação de **uma** escola, a pedido dela (D76): as seções **não corrigidas** dos materiais `pronto` e não excluídos, com componente na disciplina, ganham execução nova na fila `lote`; a correção da coordenação nunca se toca, e `falhas_seguidas` volta a zero. Trabalha em lotes de 500 seções, cada um numa transação, confere a escola e a função a cada lote e para limpo com `SIGINT` ou `SIGTERM` entre dois lotes: rodar de novo termina o que faltou, sem repetir execução. Sai com 0 e a contagem (`lotes`, `execucoes`, `secoes`); com 1 se a escola não existe (`NAO_ENCONTRADO`), a função está suspensa (`FUNCAO_SUSPENSA`) ou o erro é interno (`ERRO_INTERNO`, com o resumo tipado); com 2 se `--escola`, `--chamado` ou `OPERADOR` faltam ou têm formato inválido (a mensagem não repete o valor). Grava `escola.reclassificada` na auditoria da escola, com o chamado e as contagens (nunca título nem texto). **O comando não aplica o limite de execuções por noite da rotina** (`EXECUCOES_POR_NOITE_DA_ESCOLA`, o freio de custo de 1.000 por escola): uma escola com mais de 12 mil seções não corrigidas passa dele numa chamada só, então confira o número de seções antes (`select count(*) from secao_do_material where escola_id = '<escola_id>' and corrigida_em is null`) e, se for grande, avise a escola do custo de IA antes de rodar. Rode **fora do horário letivo**: as execuções são de lote e a janela as segura de dia, mas a transação de cada lote trava as até 500 seções dele.
- **`ops:descartar-job`** encerra o job e apaga a linha, e o alerta "Job que falhou de vez" se encerra com ela (se era a última do tipo). Grava
  `job.descartado`. **Recusa** `ia.*` e `titular.*`. No `material.extrair-pdf`, fecha o material `processando` como `falhou` (a coordenação o vê com a
  falha e pode enviar o arquivo de novo) e apaga o PDF do storage; se o storage recusar, o comando diz `objetoApagado: false` e a varredura de objetos
  apaga em até 25 h. No `retencao.*` e nos outros de escola, a linha só sai: a rotina volta na próxima rodada.
- **`--chamado`** é o número do chamado que pede a ação: inteiro positivo, nunca texto. Fora disso o comando recusa antes de abrir o banco.
- **Job sem escola** (`sistema.*`): os dois comandos o recusam, até a migration da 5.0. Enquanto isso a linha sai pelo prazo de 30 dias, e a rotina
  volta na próxima rodada agendada.
- Se o comando diz `CONFLITO`, a fila ainda tem o job como ativo (a linha está desatualizada), ou já existe um igual em andamento: espere a
  reconciliação do minuto seguinte e liste de novo.

## Seguro de limite ativo

**Dispara quando:** numa instância da API, por 2 min seguidos, metade ou mais das requisições
limitadas nos últimos 30 s foram contadas pelo seguro em memória (`limite_seguro_ativo >= 0,5`),
ou o Redis de cache não está pronto para ela (`redis_disponivel{instancia="cache"} == 0`), com ou
sem tráfego. Regra `infra/grafana/alertas/seguro-limite-ativo.yaml`; o alerta traz a `instance`.

**Impacto:** ninguém vê erro. O rate limit passa a ser de cada instância, com o limite dividido
por `LIMITE_INSTANCIAS_API`: a proteção contra abuso fica mais frouxa entre instâncias, e um
usuário que cai sempre na mesma recebe 429 mais cedo. Nada é liberado sem limite.

**Primeiro olhar:** painel, linha "Processos": "Redis disponível" e "Seguro de limite ativo".
`docker compose ps redis-cache` e `docker compose logs --since 10m api-1 api-2`, procurando
`limite.seguro_ativado` e `limite.redis_indisponivel`.

**Causas prováveis:**
1. Redis de cache parado ou reiniciando → `docker compose up -d redis-cache`. Ele não tem
   persistência e volta vazio: as janelas de limite recomeçam, e isso é esperado.
2. Redis de cache no ar, mas lento: proporção entre 0,5 e 1 com "Redis disponível" em 1, porque o
   comando passa dos 100 ms → `docker compose exec redis-cache redis-cli --latency` e
   `redis-cli info memory`. Memória no teto, expulsando chave sem parar, pede mais
   `REDIS_CACHE_MEMORIA_MAXIMA`.
3. Só uma instância dispara → o cliente daquela instância não reconecta:
   `docker compose restart api-1` (ela drena e a borda manda o tráfego para a outra).
4. Redis de cache no ar, e o log traz `login.contador_no_seguro`, `login.limite_por_ip_no_seguro`,
   `login.desafio_sem_redis` ou `login.redis_indisponivel` → quem está no seguro é o login, que guarda no Redis de fila
   o contador de tentativas, os contadores por IP (rebaixamento da escola e limite da rota de e-mail) e a marca do
   desafio (a métrica vale o maior de todos). Com ele fora, a senha errada segura a conta em cada instância, e não no
   sistema inteiro: um ataque espalhado pelas duas instâncias tem o dobro de tentativas; o limiar do rebaixamento e o
   limite por IP ficam divididos pelas instâncias. A conta que o Redis já tinha segurado continua segurada na instância
   que a viu. Ninguém é barrado por isso. `login.desafio_sem_redis` é outra coisa: o coordenador com MFA, ou quem tem
   mais de uma escola, recebe 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` no segundo fator e na escolha de escola,
   porque sem a marca o desafio não vale; nenhuma tentativa nem o desafio é gasto, e a tela espera o `Retry-After` uma vez
   (até 10 s) e repete, sem a pessoa voltar ao login; com o Redis no ar e esse
   aviso, é o Redis de fila travado (resposta acima de 100 ms): `docker compose exec redis-fila redis-cli --latency`.
   `docker compose ps redis-fila`; parado, `docker compose up -d redis-fila`. Ele é o Redis da fila de jobs também:
   veja se "Job interativo esperando" disparou junto. O corte de 100 ms vale em produção e no **staging**
   (`LOGIN_REDIS_PRAZO_MS`, que a API recusa acima disso nesses ambientes); na máquina de desenvolvimento são 2 s
   (`docs/infra.md` 5.2). No staging, num host fraco, o sintoma é este aviso com 503 em `POST /v1/sessao/escola` ou
   `/v1/sessao/mfa` e o Redis sadio — é a máquina, não o Redis. Na máquina de desenvolvimento, com o `redis-fila`
   pausado, o sintoma é outro: o login fica **lento** antes do mesmo 503, porque são seis a dez
   idas sequenciais ao Redis esperando 2 s cada. No cenário de carga local (`npm run carga:login`) o corte volta a ser
   o de produção, de propósito (`infra/carga.env`): o 401 do login por senha ou por matrícula lá é o cenário medindo o que deve
   medir (ele não passa pelo segundo fator nem pela escolha de escola, que dão o 503). E se o aviso
   aparece em **todo** login, confira `LOGIN_REDIS_PRAZO_MS` antes de procurar o Redis: um prazo mal posto, perto do
   piso, dá exatamente esse sintoma com o Redis sadio.
5. Redis de fila fora, e o log traz `sala.limite_no_seguro` → os limites da página da sala (A1) também contam no seguro
   em memória, com os tetos divididos por `LIMITE_INSTANCIAS_API`. O do nome, que é 5, cai para
   `max(1, floor(5 / instâncias))`: com duas instâncias, duas matrículas erradas num nome o travam por 10 min; com três ou
   mais, uma só. O aluno vê "Muitas tentativas agora" com a matrícula certa. O professor destrava a turma inteira com
   "Gerar novo" na tela Acesso da turma (a contagem do nome é presa ao acesso), e o Redis de fila de volta desfaz o resto.
   O código errado por escola (1.000) e o hash por turma (150) caem na mesma proporção, sem recusar ninguém.

**Se nada disso resolver:** não há o que degradar: a API segue atendendo com o seguro. Mantenha o
Redis de cache como prioridade do dia, porque com ele fora um aluno com script em laço gasta mais
antes de ser contido.

**Depois:** registre a duração e a causa no `TODO.md`. Queda por memória vira tarefa para rever
`REDIS_CACHE_MEMORIA_MAXIMA` e o volume de chaves.

## Taxa de erro 5xx

**Dispara quando:** mais de 5% das requisições de uma rota, pela rota template e somando as
instâncias do processo, respondem 5xx no último minuto, por 5 min seguidos. Rota sem requisição
no minuto não conta. Regra `infra/grafana/alertas/taxa-5xx.yaml`; o alerta traz `job` e
`http_route`. O 502 da borda (nenhuma instância respondeu) não passa pela API e não aparece aqui:
é o alerta "Sistema fora do ar", do staging.

**Impacto:** quem usa a rota vê "não foi possível concluir agora" ou "o sistema está indisponível
no momento". Com `/saude` no alerta, o Postgres está fora e tudo que lê ou grava falha.

**Primeiro olhar:** painel, linha "HTTP": "Taxa de erro 5xx por rota" e "Requisições por rota e
status", para ver se é uma rota ou todas, e se é 500 ou 503. Log:
`docker compose logs --since 10m api-1 api-2`, procurando `http.erro`, que traz `status`,
`codigo` e `requisicaoId`, nunca a mensagem nem dado.

**Causas prováveis:**
1. 503 em várias rotas, com `/saude` junto → Postgres fora ou sem conexão
   (`docker compose ps postgres`, "Pool do banco em uso" no teto) → `docker compose up -d postgres`.
   Pool no teto com o Postgres no ar é consulta lenta: procure `TEMPO_ESGOTADO` no log.
2. 500 (`ERRO_INTERNO`) numa rota só, começando depois de um commit → defeito de código: siga o
   `requisicaoId` no log até o resumo do erro. No horário letivo, volte ao commit anterior antes
   de investigar.
3. 503 numa instância só → ela está drenando ou travada: `docker compose restart api-1`.
4. 503 só em `/v1/sessao/matricula` ou `/v1/sessao/email` → é o semáforo do hash recusando quem esperou mais de 2 s,
   e o "Login recusado pelo semáforo do hash" dispara junto: siga aquela entrada. A rajada das 7h30 não gera esse
   503: no cenário de login (16.0) ela teve zero. Ele aparece sob ataque de senha (de 1% a 22% das tentativas por
   minuto na rota, no cenário) e só dispara este alerta se o ataque durar mais de 5 min, o que vale o aviso.

**Se nada disso resolver:** com a rota de prova, de login ou de ferramenta falhando no horário
letivo, avise as escolas (seção "Como avisar as escolas") e anote o horário de início, que decide
se um prazo de prova precisa ser estendido.

**Depois:** todo 500 vira tarefa, com o `requisicaoId` e um teste que reproduz. 503 por Postgres
fora entra no `TODO.md` com duração e causa.

## Reuso de refresh

**Dispara quando:** mais de 5 renovações de sessão, somadas as instâncias da API, terminam em reuso nos
últimos 10 min (`sessao_renovacao_total{resultado="reuso"}`, o máximo menos o mínimo da janela; a instância que
reiniciou na janela entra só com os reusos desde o reinício; regra `infra/grafana/alertas/reuso-de-refresh.yaml`,
sem `for:`). Reuso é o cookie `educa_sessao` anterior voltando
depois de o token novo já ter sido usado e de passada a janela de 30 s: alguém guardou um cookie velho. Cada
reuso já encerrou a família de sessões dele (motivo `reuso_de_refresh`) e gravou a auditoria
`sessao.reuso_de_refresh`. O alerta não traz escola nem pessoa: a métrica não leva nenhuma das duas.

**Impacto:** a pessoa de cada família encerrada volta para a tela de entrada no meio do que fazia, e entra de
novo. Se é ataque, quem guardou o cookie perdeu o acesso na hora; se é bug de cliente, gente legítima está sendo
deslogada sem motivo.

**Primeiro olhar:** painel, linha "Processos": "Renovações de sessão por resultado", para ver se o reuso vem
sozinho ou junto de `ja_renovado` e `resposta_perdida`. Depois as famílias afetadas, só por ids:

```sql
select escola_id, entidade_id as sessao_id, depois->>'familia' as familia, depois->>'sessoesEncerradas' as encerradas, em
from auditoria where acao = 'sessao.reuso_de_refresh' and em > now() - interval '30 minutes' order by em;
```

e, para uma família, `select escola_id, usuario_id, metodo, rotacionado_em, encerrada_em from sessao where
familia = '<familia>'`. Não copie nome nem matrícula para lugar nenhum: para investigar, os ids bastam.

**Causas prováveis:**
1. Os reusos vêm de uma escola só, de poucos usuários, e cada família tem uma sessão → cookie copiado de um
   Chromebook compartilhado, ou extensão/script guardando cookie. É o que o reuso existe para cortar: nada a
   desfazer. Avise a coordenação daquela escola (seção "Como avisar as escolas") para ver quem usou o computador,
   sem mandar id de aluno por e-mail.
2. Os reusos vêm de várias escolas, começaram depois de um deploy da web, e `ja_renovado` subiu junto → bug do
   cliente: duas abas renovando sem a trava (Web Locks), ou a web repetindo a renovação com o cookie velho depois
   de um 409. Volte a web ao commit anterior no próximo intervalo fora do horário letivo e abra tarefa com o
   caso reproduzido; até lá, cada família derrubada é uma pessoa que entra de novo.
3. Os reusos vêm de um mesmo IP de saída de rede, em várias contas, em sequência → alguém testando cookies
   roubados. Confira `registro_acesso` pelo IP (`evento = 'renovacao'`) e registre; o bloqueio já aconteceu, porque
   a família caiu no primeiro uso. O IP é dado pessoal: fica na investigação, não vai para o `TODO.md` nem por
   e-mail para a escola.

**Se nada disso resolver:** o reuso não tem degradação a ligar: ele encerra só a família afetada, e nenhuma escola
para por ele. Se for bug de cliente em massa no horário letivo, avise as escolas de que "a sessão pode pedir para
entrar de novo" até a correção.

**Depois:** registre no `TODO.md` a hora, quantas famílias e de quantas escolas (só números e ids), e a causa.
Bug de cliente vira tarefa com teste; ataque vira conversa com a escola sobre o computador compartilhado.

## Login lento

**Dispara quando:** o p95 de `login.duracao` no último minuto, somando as instâncias da API e os dois métodos
(e-mail e matrícula), passa de 1 s por 3 min seguidos (`histogram_quantile(0.95, …login_duracao_seconds_bucket…) > 1`,
regra `infra/grafana/alertas/login-lento.yaml`). A duração vai do pedido à resposta e conta todo desfecho: entrou,
senha errada, conta segurada e o 503 do semáforo do hash. O alerta não traz escola nem pessoa.

**Impacto:** alunos e professores esperam para entrar. Às 7h30 é a turma inteira parada na frente do Chromebook,
com a web mostrando "entrando…" e repetindo sozinha por até 30 s; quem passa disso vê erro.

**Primeiro olhar:** painel, linha "Processos": "Login (p95) por método", "Espera pelo hash por escola (p95)" e
"Logins recusados pelo semáforo". Espera alta num balde só é uma escola (ou a `equipe`, ou `desconhecida`) lotando o
login; espera alta em todos os baldes é a instância sem capacidade. Depois "Atraso do event loop (p99)" e "Pool do banco
em uso", e `docker stats api-1 api-2` para a CPU de cada API.

**Causas prováveis:**
1. Espera pelo hash alta em todas as escolas, CPU da API no teto, dentro do horário de entrada → falta capacidade de
   hash: `docker compose ps api-1 api-2` (uma instância fora dobra a fila da outra) e suba a que caiu com
   `docker compose up -d api-2`. Com as duas de pé e a CPU no teto, suba mais uma instância, se houver onde. Rever
   `LOGIN_HASH_CONCORRENCIA` e o custo do argon2 (`LOGIN_ARGON2_ITERACOES`) é decisão, fora do horário letivo, com o
   cenário "login às 7h30" (tarefa 16.0); nunca abaixo da OWASP e nunca acima de `UV_THREADPOOL_SIZE − 8`.
2. Espera alta só no balde `equipe`, ou só em `desconhecida`, com as escolas normais → ataque de senha ao login por
   e-mail, ou a endereço que não existe. O rodízio segura o resto: alunos das escolas entram. Siga o "Login recusado
   pelo semáforo do hash", causa 2.
3. Espera pelo hash baixa e login lento assim mesmo → o tempo está fora do hash: Postgres (pool no teto, `TEMPO_ESGOTADO`
   no log) ou Redis de fila lento (`login.contador_no_seguro` no log). Siga "Taxa de erro 5xx", causa 1, ou "Seguro de
   limite ativo", causa 4.
4. Espera pelo hash alta em todos os baldes, com a CPU das APIs baixa → não é falta de capacidade de hash, e subir
   instância não resolve: a vez no semáforo cobre também a reserva no contador de tentativas (Redis de fila) e a leitura
   da credencial (Postgres), e com um dos dois lento cada vez demora mais para voltar. Olhe "Pool do banco em uso" e o
   log (`TEMPO_ESGOTADO`, `login.contador_no_seguro`, `login.limite_por_ip_no_seguro`), e
   `docker compose exec redis-fila redis-cli --latency`. Um `addBulk` grande ou um script de fila longo no Redis de fila
   às 7h30 é o suspeito de sempre: lote fica fora do horário letivo (`docs/infra.md`, seção 5.2).

**Se nada disso resolver:** avise as escolas afetadas (seção "Como avisar as escolas") de que o login está lento e de
que a tela tenta de novo sozinha: ninguém precisa recarregar a página. Deploy só fora do horário letivo (D27): não
reinicie as duas APIs juntas no horário de entrada.

**Depois:** registre no `TODO.md` o horário, o p95 que chegou, quantas instâncias estavam de pé e a CPU delas (só
números). Capacidade que não bastou na entrada vira tarefa de calibração com o cenário de carga.

## Login recusado pelo semáforo do hash

**Dispara quando:** mais de 1% dos logins do último minuto, somando as instâncias da API, saem com 503
`INDISPONIVEL_TENTE_DE_NOVO` porque esperaram mais de 2 s pela vez no semáforo do hash de senha, por 3 min seguidos
(`login_hash_recusado_total` sobre `login_duracao_seconds_count`, regra
`infra/grafana/alertas/login-hash-recusado.yaml`). O semáforo roda no máximo `LOGIN_HASH_CONCORRENCIA` hashes por
instância e atende os baldes em rodízio: um por escola (matrícula), um `equipe` (todo login por e-mail, com a vez
rodando por IP) e um `desconhecida` (endereço de escola que não existe). O alerta não traz escola nem pessoa.

**Impacto:** a web recebe o 503 com `Retry-After` de 2 a 6 s e tenta de novo sozinha, mostrando "entrando…". Quem
não consegue a vez em 30 s vê erro. O 503 não conta como senha errada e não segura conta nenhuma.

**Primeiro olhar:** painel, linha "Processos": "Espera pelo hash por escola (p95)", para ver qual balde está cheio,
"Logins recusados pelo semáforo" e "Login (p95) por método". Depois a CPU das APIs (`docker stats api-1 api-2`) e
quantas estão de pé (`docker compose ps api-1 api-2`).

**Causas prováveis:**
1. Todos os baldes esperando, na entrada da manhã, com uma instância fora ou a CPU no teto → capacidade. Suba a
   instância que caiu (`docker compose up -d api-1`), ou mais uma. Rever `LOGIN_HASH_CONCORRENCIA` e o custo do hash é
   decisão fora do horário letivo, com o cenário de carga (tarefa 16.0).
2. Só o balde `equipe` esperando, com as escolas normais → ataque distribuído ao login por e-mail: muitos IPs tentando
   senhas. O rodízio por IP e o balde separado seguram os alunos; a equipe de todas as escolas entra mais devagar
   (risco aceito no F1, Tech Spec da identidade, seção 13). Confira `registro_acesso` com `evento = 'login_falho'` e
   escola nula no último quarto de hora, contando por IP, só para a investigação: o IP é dado pessoal, não vai para o
   `TODO.md` nem por e-mail. Um IP só pedindo muito é assunto do limite por IP da rota de e-mail (tarefa 15.0).
3. Só o balde de uma escola esperando → aquela escola inteira entrando junto (rajada legítima) ou alguém da rede dela
   errando senha em massa. As outras escolas não sentem. Rajada legítima passa em minutos; falha em massa aparece como
   `login.conta_segurada` subindo junto.
4. Só `desconhecida` esperando → alguém tentando endereços de escola que não existem. Não atrasa escola real; registre
   e acompanhe. O mesmo aparece em "Falhas de login por escola", na série `desconhecida`: todos os endereços que não
   existem contam num contador comum (11.0), que cresce com varredura de endereço e não segura nem rebaixa escola
   nenhuma, porque não é de escola nenhuma. Para ver de onde vem, `registro_acesso` não ajuda (endereço que não existe
   não grava registro): olhe a borda (`docker compose logs --since 10m borda`).
5. Uma escola no primeiro dia, com a turma inteira reivindicando o nome na página da sala (A1) → a reivindicação roda o
   hash no mesmo semáforo, no balde da escola, e soma no recusado e na espera, mas não no denominador do alerta, que conta
   só login. Com muita reivindicação e pouco login, a razão sobe sem o login ter piorado. Confira no painel "Reivindicações
   de nome na sala": `indisponivel` subindo junto é a reivindicação recebendo o 503; a página repete sozinha com a
   mesma chave, e nenhum pedido se perde nem se duplica. Passa com a rajada; se não passar, é a causa 1.

**Se nada disso resolver:** avise as escolas afetadas (seção "Como avisar as escolas") de que o login está demorando
e de que a tela tenta sozinha. Não desligue o semáforo: sem ele, o hash toma a CPU da API e tudo fica lento, não só o
login.

**Depois:** registre no `TODO.md` o horário, a duração, qual balde encheu (o id da escola, `equipe` ou `desconhecida`)
e a causa. Capacidade que não bastou vira tarefa de calibração; ataque vira registro com a escola, sem IP.

## Login rebaixado numa escola

**Dispara quando:** numa instância da API, a série `login.prioridade_rebaixada` de uma escola fica em 1 por 2 min
seguidos (`max by (escola_id) (login_prioridade_rebaixada)`, regra `infra/grafana/alertas/login-rebaixado-por-escola.yaml`).
Ela vai a 1 quando um IP passa de `max(100, 25% dos alunos ativos da escola)` falhas de login por matrícula em um
minuto naquela escola, e as tentativas desse IP para essa escola passam a ir para o fim da fila dela. O alerta traz a
escola, nunca o IP.

**Impacto:** ninguém é bloqueado, e nenhuma outra escola sente. Quem entra pelo mesmo IP e já entrou naquele navegador
nos últimos 30 dias (cookie `educa_dispositivo`) mantém a vez. Quem nunca entrou naquele navegador espera o fim da fila
da escola, e sob ataque forte pode ver "entrando…" por mais tempo; a web repete sozinha por até 30 s.

**Primeiro olhar:** painel, linha "Processos": "Escola com login rebaixado", "Falhas de login por escola" (quantas por
minuto) e "Espera pelo hash por escola (p95)" daquela escola. Para saber o IP, e só para a investigação:
`registro_acesso` com `evento = 'login_falho'` daquela escola nos últimos 15 min, contando por IP. O IP é dado pessoal:
não vai para o `TODO.md`, para e-mail nem para chat.

**Causas prováveis:**
1. O IP que falha em massa é o IP de saída da própria escola → ataque de dentro da rede: um aluno com script tentando
   matrículas. É o caso que o rebaixamento existe para aguentar. Avise a coordenação da escola (seção "Como avisar as
   escolas") de que alguém na rede dela está testando senhas, com o horário; ela sabe onde procurar. Não bloqueie o IP
   da escola: são 400 alunos atrás dele.
2. O IP é de fora (não é o da escola, nem de uma rede cadastrada) → ataque de fora, contra matrículas daquela escola. Os
   alunos da escola, que saem por outro IP, nem são rebaixados. Registre e acompanhe; se durar, avise a escola.
3. O IP é o de saída de uma rede municipal, e a escola é da rede → várias escolas saindo pelo mesmo IP e uma delas com
   muitas senhas erradas de verdade (primeiro dia de aula). Confira se a rede tem `rede.ips_saida` cadastrado (no F1,
   por comando; a tela é do F14): sem ele, a rota de e-mail da equipe dessa rede também fica limitada como IP comum.
4. Muitas falhas legítimas numa escola pequena na primeira semana → o limiar tem piso de 100 por minuto justamente
   para isso; se ainda assim disparar, é senha trocada em massa (reset da escola) e passa sozinho em minutos.

**Rebaixado pelo volume, e não pelas falhas:** a espera pelo hash de uma escola pode subir sem este alerta. É o outro
rebaixamento, o do limite por IP das rotas de login (`LIMITE_REQ_IP_ANONIMO_MIN` por minuto, num balde próprio): o IP
que manda mais tentativas que isso, certas ou erradas, vai para o fim da fila, com a mesma passagem pelo cookie. Ele
aparece em `login.rebaixado_ip` (painel "Login rebaixado pelo limite por IP das rotas de login"), sem escola e sem
IP. Subiu junto com a espera de uma escola e sem falhas dela: é volume, não senha errada (um script ou uma rede
inteira atrás de um IP só). O que fazer é o mesmo: ninguém é recusado, não bloqueie o IP. Se for uma rede municipal,
confira o `rede.ips_saida` (causa 3). Com a fila cheia (10.000 esperando numa instância), quem sai com 503 para dar
lugar a quem não foi rebaixado é o rebaixado mais antigo da fila com mais rebaixados, nunca quem traz o cookie.
Esse rebaixado pode ser alguém de verdade sem o cookie (um professor atrás do NAT da escola): a web repete o 503 e
ele entra depois.

**Quanto a sala gasta desse limite (acesso-e-convites, 16.0).** As rotas anônimas da sala entram no balde por IP da escola inteira atrás do NAT (`rl:ip`),
e o `LIMITE_REQ_IP_ANONIMO_MIN` é **6.000 por minuto** desde a 16.0 (eram 3.000). O login por matrícula não é desse balde: é o `rl:ip-login`, que rebaixa e não
recusa. Gasto por aluno no balde anônimo: **3 requisições pela matrícula** (abrir a sala, ler os provedores, pedir o nome), **9 pela conta da escola** (as 3, mais
a ida ao provedor e a volta, a sala aberta de novo, e a entrada depois da aprovação: `iniciar`, `retorno` e `renovar`), e mais 1 por código errado ou matrícula
errada. No `k2_conta` (2.100 alunos em 5 min, cerca de 85% pela conta) o pico lido do Redis foi de **3.678 por minuto**, 61% do teto, sem 429. Escola que
reclamar de 429 no primeiro dia: veja primeiro se o `.env` da produção já tem os 6.000 (o deploy não o traz sozinho: o `infra/compose.yml` lê o valor do `.env` da VPS, que segue nos 3.000 até alguém trocá-lo; item no `TODO.md`), depois conte alunos pela conta e erros de digitação
antes de mexer no número, e lembre que o prazo da leitura dos provedores (`PRAZO_DOS_PROVEDORES_MS`) só poupa a repetição na mesma aba, não alivia o balde da
escola. O consumo se mede pela escola, como no resto deste runbook: o 429 por escola no log ou na métrica, sem IP, e a conta de alunos pela conta e de erros de digitação acima. Ninguém lê as chaves `rl:ip` do Redis à mão (`docs/lgpd.md`, "IP só em memória, no login"); ler o balde na produção seria finalidade nova, e entra primeiro em `docs/lgpd.md`, com prazo e quem pode ler.

**Se nada disso resolver:** não há o que desligar: o rebaixamento não recusa ninguém. Nunca bloqueie o IP da escola na
borda, nem por "só uns minutos" (regra 80, item 1). Se a escola reclamar de lentidão para entrar, oriente a entrar
pelo navegador de sempre, que guarda a prioridade.

**Depois:** registre no `TODO.md` o horário, a duração e a escola (o id), se o ataque veio de dentro ou de fora da rede
dela, e o que a escola fez. Sem IP.

## Login por e-mail acima do limite por IP

**Dispara quando:** mais de 20 tentativas de login por e-mail por minuto, somando as instâncias da API, são rebaixadas
pelo limite por IP da rota, por 5 min seguidos (`login_limite_email_ip_total`, regra
`infra/grafana/alertas/login-email-limite-ip.yaml`). O limite é `LIMITE_LOGIN_EMAIL_IP_MIN` (60) tentativas por minuto de
um IP, vezes o número de escolas da rede quando o IP é o de saída dela (`rede.ips_saida`). O alerta não traz IP nem
escola.

**Impacto:** ninguém é bloqueado. As tentativas do IP acima do limite vão para o fim da fila da equipe; quem traz no
cookie `educa_dispositivo` a própria conta mantém a vez. A equipe atrás desse IP que entra num navegador novo espera
mais. As escolas e os alunos (matrícula) não sentem: a equipe tem fila própria.

**Primeiro olhar:** painel, linha "Processos": "Login por e-mail rebaixado pelo limite por IP", "Falhas de login por
escola" na série `equipe` e "Espera pelo hash por escola (p95)" na `equipe`. Para saber o IP, e só para a investigação:
`registro_acesso` com `evento = 'login_falho'` e escola nula nos últimos 15 min, contando por IP. O IP é dado pessoal: não
vai para o `TODO.md`, para e-mail nem para chat.

**Causas prováveis:**
1. Um IP de fora tentando e-mails e senhas (lista vazada, varredura) → é o que o limite existe para conter. Registre e
   acompanhe; o contador por conta segura cada e-mail atacado no navegador do atacante, e o professor no próprio
   computador continua entrando.
2. O IP é o de saída de uma rede municipal que não tem `rede.ips_saida` cadastrado → a equipe de várias escolas atrás
   de um IP só passa de 60 por minuto no começo do turno. Cadastre o IP na rede (no F1, por comando; a tela é do F14):
   o limite vira 60 vezes as escolas dela. Confirme com a rede qual é o IP público de saída antes de cadastrar.
3. O IP é o de uma escola, e a equipe dela não passa de algumas dezenas de pessoas → alguém na rede da escola testando
   e-mails. Avise a coordenação da escola, com o horário. Não bloqueie o IP da escola.

**Se nada disso resolver:** não há o que desligar: o limite não recusa ninguém. Nunca bloqueie o IP de uma escola ou
rede na borda (regra 80, item 1). Se o ataque vier de muitos IPs, o que avisa é "Login recusado pelo semáforo do hash"
(causa 2), e é risco aceito no F1 (Tech Spec da identidade, seção 13).

**Depois:** registre no `TODO.md` o horário, a duração, se era rede sem `ips_saida` (e se ela foi cadastrada) ou
ataque, sem IP.

## Código da turma errado em massa numa escola

**Dispara quando:** mais de 10 tentativas por minuto, somadas as instâncias da API, passam do teto de códigos da turma
errados numa escola (1.000 em 10 min), por 5 min seguidos (`sum (rate(sala_limite_atingido_total{job="educa/api",
tipo="escola"}[1m])) * 60 > 10`, regra `infra/grafana/alertas/sala-codigo-errado-por-escola.yaml`; Tech Spec da A1, seção
7c). A manhã da escola inteira no primeiro dia erra uns 420 códigos em 5 min, abaixo do teto: acima dele, por 5 min, é
alguém tentando códigos. O alerta não traz escola nem IP (`METRICS_WITH_ESCOLA` é fechada).

**Impacto:** ninguém é recusado. Enquanto a escola estiver acima do teto, todo `salas/abrir` pelo código dela espera 1 s,
também o do código certo; o link, o login e as outras escolas não sentem. A espera atrasa cada tentativa, mas não limita
o volume do atacante: quem limita é só o limite por IP das rotas anônimas, e muitos IPs passam dele. Por isso a resposta
é revogar, e não esperar o ataque cansar. O risco é outro: quem acerta um código vigente vê os nomes
livres daquela turma, que são de menores. Um IP sozinho, no teto do `rl:ip` (6.000 por minuto desde a 16.0, eram 3.000), leva uma semana para ter ~0,4% de chance (eram ~0,2%);
com muitos IPs, a chance cresce na mesma proporção, e é por isso que este alerta existe.

**Primeiro olhar:** a escola, no log da API: a linha `sala.limite_atingido` com `tipo` `escola` traz o `escolaId`, que é
o que o comando abaixo recebe. É o que basta, porque a resposta na A1 é por escola, não por IP.
Não procure o IP: as rotas da sala não gravam registro de acesso (Tech Spec da A1, seção 7), e ninguém lê as chaves
`rl:ip` do Redis à mão, nem durante o alerta (`docs/lgpd.md`, "IP só em memória, no login"). Se o log trouxer mais de
uma escola, cada uma segue os passos abaixo.

**Causas prováveis:**
1. Alguém tentando códigos contra a escola, de fora ou de dentro da rede dela → revogue os acessos da escola:
   `OPERADOR=<você> npm run -s ops:revogar-acessos-sala -- --escola <escolaId do log>`. Link e código de todas as turmas dela
   caem na hora, e o que o atacante já testou deixa de valer. O comando imprime só a contagem e grava cada revogação
   na auditoria da escola. Avise a coordenação (seção "Como avisar as escolas"), com o horário, de que cada professor
   precisa gerar um código novo na tela Acesso da turma antes da próxima aula; se o ataque veio de dentro, ela sabe
   onde procurar.
2. O ataque volta depois da revogação, contra os códigos novos → alguém dentro da sala está vendo o código projetado
   (Tech Spec da A1, seção 13). Revogue de novo, trate como incidente (seção "Como avisar as escolas") e combine com a
   coordenação o passo seguinte, abaixo.
3. Sem este alerta, um professor relata que um ou mais nomes não entram, com "Muitas tentativas agora", mesmo com a
   matrícula certa → é o limite por nome (`sala.limite_atingido{tipo="nome"}`), e não o da escola: qualquer um com o link
   ou o código trava um nome por 10 min com cinco matrículas erradas. O professor destrava na hora com "Gerar novo" na tela
   Acesso da turma (a contagem do nome é presa ao acesso que a gerou) e projeta o código novo. Se voltar com o código novo,
   é a causa 2.

**Se nada disso resolver:** não há como desligar a página da sala só para uma escola. Com os acessos revogados, o
atacante precisa começar de novo contra os códigos novos, e cada um vale no máximo 30 dias. Se o ataque não parar,
combine com a coordenação que os professores gerem o código na hora da aula, com validade de 1 dia, e o revoguem ao
fim dela. Não bloqueie IP na borda na A1: não há de onde tirar o IP sem ler dado que ninguém lê, e o IP de saída da
escola esconde centenas de alunos (regra 80, item 1). O bloqueio na borda fica para quando existirem o staging e o
provedor (D42), com finalidade e prazo no `docs/lgpd.md` antes do primeiro uso, e nunca em arquivo versionado: o
repositório é público (`TODO.md`).

**Depois:** registre no `TODO.md` o horário, a duração, a escola (o id) e quantos acessos foram revogados. Sem IP. Se
durou mais de um dia ou voltou depois da revogação, registre como incidente e reveja a prioridade do balde próprio da
sala no limite por IP (`rl:ip:sala`), previsto para o F2.

## Expurgo incompleto por duas noites numa escola

**Dispara quando:** nas duas últimas noites, contadas no fuso da escola, o expurgo dela não terminou todas as categorias,
por 1 min (`max by (escola_id) (expurgo_noites_incompletas{job="educa/worker"}) > 1`, regra
`infra/grafana/alertas/expurgo-noites-incompletas.yaml`; Tech Spec do F3, seção 7c). Uma noite está completa quando cada
categoria do expurgo tem uma linha `concluida = true` em `expurgo_execucao` naquela data local; a categoria sem linha
conta como não concluída. O worker-lote mede a cada 5 min, e o alerta traz o `escola_id`. A noite anterior à primeira
execução da escola não conta: escola nova e a primeira noite depois do deploy não disparam.

**Impacto:** nenhuma pessoa vê nada. O que está em jogo é a lei: o dado de pessoa daquela escola que passou do prazo de
`docs/lgpd.md` (conversa do Tutor, sinais, conversa do professor, pedidos à IA, trabalho do aluno, cadastro de quem foi
desativado) fica no banco além dele, e cada noite a mais aumenta o atraso. Uma noite
interrompida pela janela letiva é esperada (o resto sai na seguinte); duas seguidas, não.

**Primeiro olhar:** a escola de relance, só com contagens, num JSON só: `OPERADOR=<seu apelido> npm run -s ops:privacidade -- --escola <escola_id>`
(pedidos por estado, eliminações agendadas e vencidas, arquivos ativos e vencidos, suboperadores vigentes, incidentes avisados e
sem confirmação, e em `expurgo` quantas categorias terminaram na última execução, quantas pararam e quando foi a mais
recente; nunca nome nem id de titular). Depois as noites da escola, também só com contagens:
`docker compose exec postgres psql -U educa -c "select categoria, linhas, concluida, em from expurgo_execucao where escola_id = '<escola_id>' order by em desc limit 20"`.
Depois o job da escola em `job_registro` (`tipo = 'retencao.expurgar-escola'`, a chave é a data local) e o log do
worker-lote: `docker compose logs --since 48h worker-lote-1 worker-lote-2 | grep -E 'retencao\.'` (`retencao.expurgada`,
`retencao.expurgo_interrompido`, `retencao.rotina_disparada`, `retencao.escola_nao_enfileirada`, só com ids e contagens).

**Causas prováveis:**
1. Linhas com `concluida = false` nas duas noites, sempre na mesma categoria → a janela letiva abre antes de o volume da
   escola acabar: o job começa à 1h, mas, com a vaga de lote da escola ocupada, só sai mais tarde. Confira o
   `iniciado_em` dos jobs da escola. Se o volume é de um único dia de recuperação (escola nova com histórico, ou prazo
   recém-encurtado pelo `ops:retencao`), deixe as noites seguintes terminarem: cada uma começa pela categoria pendente.
   Se repete, é decisão: aumentar a vaga de lote da escola (`configuracao_operacional_escola`) ou o horário fora da
   janela; registre.
2. Nenhuma linha nas duas noites → o job da escola não rodou. Sem `retencao.expurgar-escola` da data em `job_registro`,
   a rotina das 1h não enfileirou (veja `retencao.escola_nao_enfileirada` e o job `sistema.expurgar-dado-pessoal`); com o
   job `falhou`, o `codigo_falha` e o log dizem por quê. O worker-lote parado ou a fila `agendamentos` sem agendador é a
   seção "Rotina do sistema sem rodar", abaixo.
3. O job da escola falha no meio (lote acima do `statement_timeout` de 2 s, erro de SQL) → a categoria em que ele falhou
   grava `concluida = false` antes de o erro subir (inclusive na primeira noite da escola, que é o que faz o alerta valer
   para ela), a fila tenta de novo, e a noite seguinte começa por ela. O log traz o `jobId` e o erro resumido (SQLSTATE e
   restrição); se nem a linha `false` gravou, aparece `retencao.registro_nao_gravado`, e a noite fica sem linha (causa 2).
   Uma categoria que falha toda noite segura as que vêm depois dela na ordem (`TODO.md`). Lote lento é índice faltando ou
   tabela inchada: rode o `EXPLAIN` do lote (o teste do expurgo da escola mostra a instrução) antes de mudar o lote.

**Se nada disso resolver:** rode o expurgo da escola à mão, fora do horário letivo, gravando um job dela não urgente
(`retencao.expurgar-escola`, fila `lote`, com a data local como chave) pelo mesmo caminho da rotina: ele tolera reexecução
(D49) e começa pela categoria pendente. A escola não precisa ser avisada enquanto o atraso for de dias; se passar de uma
semana, registre como descumprimento de retenção no `TODO.md` e avise a coordenação (seção "Como avisar as escolas").

**Depois:** registre no `TODO.md` a escola (id), as noites, as categorias e a causa, só com ids e contagens. Causa nova
vira tarefa com teste que a reproduz.

## Incidente sem confirmação em 24 h

**Dispara quando:** a Turmma soube de um incidente de segurança que afetou a escola há mais de 24 h e a coordenação dela ainda
não confirmou ter recebido o aviso, por 1 min (`max by (escola_id) (incidente_horas_sem_confirmacao{job="educa/worker"}) > 24`,
regra `infra/grafana/alertas/incidente-sem-confirmacao.yaml`; Tech Spec do F3, seção 7c). A métrica é o número de horas desde o
`conhecido_em` do incidente mais antigo da escola em `incidente`, entre os que têm a seção da escola em `incidente_escola` com
`confirmado_em` nulo; o worker-lote a mede a cada 5 min, e o alerta traz o `escola_id`, nunca o incidente. Sem incidente
pendente a escola não tem série, e ela some quando a coordenação confirma.

**Impacto:** a escola é a controladora (D10) e tem 3 dias úteis, contados do conhecimento dela, para comunicar a ANPD e os
titulares (Resolução CD/ANPD nº 15/2024); o prazo nosso, de 24 h da detecção, é o que dá a ela esses dias inteiros
(`docs/lgpd.md`, seção 8). Passado, o risco é a escola descobrir tarde ou ficar sem tempo de avisar as famílias. Nenhuma
pessoa vê nada na tela além do aviso que a coordenação ainda não abriu.

**Primeiro olhar:** as seções pendentes da escola, só com ids e datas (nunca o texto):
`docker compose exec postgres psql -U educa -c "select ie.id, i.conhecido_em, ie.avisado_em from incidente_escola ie join incidente i on i.id = ie.incidente_id where ie.escola_id = '<escola_id>' and ie.confirmado_em is null order by i.conhecido_em"`.
A coordenação lê o aviso e o confirma pela API (`GET /v1/privacidade/incidentes` e `POST /v1/privacidade/incidentes/:id/confirmar`);
a tela dela, em Privacidade, Incidentes, e o aviso que abre ao entrar são da tarefa 10.0.

**Causas prováveis:**
1. Ninguém da coordenação entrou desde o aviso → avise por fora do sistema (telefone ou o canal que a escola indicou no
   contrato; a seção "Como avisar as escolas" ainda é "a definir antes do piloto") e diga só que há um aviso de segurança
   esperando na tela de Privacidade. Não mande o conteúdo do incidente por e-mail nem por mensagem.
2. A única coordenação não passou do segundo fator, ou perdeu o acesso → peça o convite novo ou a redefinição do segundo fator
   pelos comandos da operação (`ops:convite-coordenador`, `ops:redefinir-mfa`), que têm o próprio fluxo de conferência.
3. A coordenação confirmou e a série continua → confira `confirmado_em` na consulta acima. Se está preenchido, a medição
   está atrasada ou o worker-lote não mede (log `worker.medicao_do_incidente_indisponivel`: o Postgres respondeu com erro);
   a série some na volta seguinte de 5 min.
4. O incidente foi registrado com `conhecidoEm` muito antes do registro → o relógio das 24 h já vinha estourado quando a seção
   chegou à escola. Não é falha do alerta: registre a causa do atraso entre a detecção e o registro (próximo passo).

**Se nada disso resolver:** a confirmação é um ato da escola e **não há comando nosso que a faça por ela**: não escreva
`confirmado_em` no banco. Escale ao dono do produto e à pessoa de contato da escola; o que fica provado é a tentativa de avisar.

**Ao registrar o incidente (`ops:incidente`):** descreva o caminho e o volume, nunca quem: nenhum nome de aluno, professor ou responsável nos três textos (`circunstancias`, `contencao`, `correcao`). O comando recusa o nome inteiro e o id de outra escola do mesmo arquivo, mas não o nome parcial dela ("Ametista" sem "Colégio") nem o de uma pessoa: leia cada seção como se fosse a coordenação da escola dela antes de rodar. O comando não tem chave de idempotência: rodar o mesmo arquivo duas vezes grava dois incidentes, com dois alertas, e o segundo não se desfaz pela API.

**Depois:** registre no `TODO.md` a escola (id), o incidente (a data em que soubemos), quando e como a coordenação foi avisada
por fora e quando confirmou, só com ids e datas. O atraso entre a detecção e o registro, se foi ele, vira tarefa do processo de
incidente (`docs/lgpd.md`, seção 8).

## Arquivo do titular em preparação há mais de 2 h

**Dispara quando:** o pedido de acesso ou de portabilidade mais antigo de uma escola está `em_preparacao` há mais de 2 h, por 1
min (`max by (escola_id) (arquivo_horas_em_preparacao{job="educa/worker"}) > 2`, regra
`infra/grafana/alertas/arquivo-em-preparacao.yaml`; Tech Spec do F3, seção 7c). A métrica é o número de horas desde o
`registrado_em` do pedido `em_preparacao` mais antigo da escola em `pedido_titular`; o worker-lote a mede a cada 5 min, e o alerta
traz o `escola_id`, nunca o pedido nem o titular. Sem pedido em preparação a escola não tem série, e ela some quando o job termina
e o pedido fica `pronto`.

**Impacto:** a escola tem 15 dias, contados da chegada do pedido, para a declaração completa (LGPD, art. 19, II), e o arquivo é
a resposta. Duas horas sem arquivo não estouram o prazo, mas dizem que o job não está terminando, e o titular ou a coordenação
esperam sem saber. Nada vaza: o arquivo só existe depois de pronto.

**Primeiro olhar:** o pedido e o job dele, só com ids, estados e datas (nunca o conteúdo):
`docker compose exec postgres psql -U educa -c "select p.id, p.tipo, p.estado, p.registrado_em, j.estado as job, j.codigo_falha from pedido_titular p left join job_registro j on j.escola_id = p.escola_id and j.tipo = 'titular.montar-arquivo' and j.dados->>'pedidoId' = p.id::text where p.escola_id = '<escola_id>' and p.estado = 'em_preparacao' order by p.registrado_em"`.
O log do worker traz `job.tentativa_falhou` com o código e o erro resumido, e nunca a chave do objeto nem a URL.

**Causas prováveis:**
1. O storage está fora ou recusa a credencial → `docker compose ps storage` e o log do `worker-interativo`
   (`job.tentativa_falhou`, `erro: armazem_indisponivel`). O job repete até esgotar as tentativas; com o storage de volta, um job que
   ainda tem tentativa conclui sozinho. Se o job já `falhou` (`codigo_falha = ERRO_INTERNO`), o pedido segue `em_preparacao` e não
   volta sozinho: a coordenação o conclui e **registra outro pedido** do mesmo titular, que gera o arquivo do zero (o objeto é
   sobrescrito; não há nada a limpar).
2. O job está esperando vaga ou não foi despachado (`job_registro.estado` em `aguardando`, `reservado` ou `publicado`) → o
   `worker-interativo` ou o `despachante` está parado; veja "Job interativo esperando".
3. O titular foi eliminado depois de pedir (log `titular.arquivo_sem_titular`) → não há o que montar, e o pedido de acesso fica
   `em_preparacao`. A coordenação o conclui pela tela; é o caminho previsto.
4. A leitura do arquivo estoura o `statement_timeout` de uma escola grande → o log do `worker-interativo` traz `job.tentativa_falhou` com o código da
   consulta (`57014`, cancelamento por tempo) em toda tentativa. O job esgota as tentativas e o pedido segue `em_preparacao`. Confira, com
   `explain`, se a leitura da tabela citada desce pelo índice (`resposta_atividade_aluno_idx`, `registro_acesso_usuario_idx`,
   `correcao_destaque_aberto_por_idx`, `auditoria_escola_autor_idx`, `consumo_ia_execucao_idx`) e abra a correção; enquanto isso a coordenação
   conclui o pedido pela tela.
5. O pedido foi concluído antes de o job terminar e a série continua → o `estado` já não é `em_preparacao`: a medição está
   atrasada, ou o worker-lote não mede (log `worker.medicao_do_arquivo_indisponivel`: o Postgres respondeu com erro). A série some
   na volta seguinte de 5 min.

**Se nada disso resolver:** o arquivo não se escreve à mão no storage nem no banco: o `arquivo_titular` e o objeto são do job, e uma
linha sem objeto faz o download responder `INDISPONIVEL_TENTE_DE_NOVO`. Escale ao dono do produto e avise a coordenação de que o
arquivo atrasou, sem mandar conteúdo por mensagem.

**Depois:** registre no `TODO.md` a escola (id), o pedido (id), quando foi registrado e a causa, só com ids e datas. Causa nova vira
tarefa com teste que a reproduz.

## Eliminação do titular agendada há mais de 48 h do prazo

**Dispara quando:** o pedido de eliminação `agendado` mais antigo de uma escola venceu (`eliminar_em`) há mais de 48 h e ainda não
foi concluído, por 1 min (`max by (escola_id) (eliminacao_horas_vencida{job="educa/worker"}) > 48`, regra
`infra/grafana/alertas/eliminacao-vencida.yaml`; Tech Spec do F3, seção 7c). A métrica é o número de horas desde o `eliminar_em`
do pedido `agendado` já vencido mais antigo da escola em `pedido_titular`; o worker-lote a mede a cada 5 min, e o alerta traz o
`escola_id`, nunca o pedido nem o titular. A escola sem eliminação vencida não tem série, e ela some quando o job conclui o
pedido. Uma noite em que a janela letiva interrompeu a troca de nome é esperada e cabe nas 48 h: o alerta é a segunda noite sem
concluir.

**Impacto:** a eliminação é direito do titular (LGPD, art. 18, VI), e o 8º dia é o prazo que a escola anunciou. Vencido, a pessoa
continua com o acesso suspenso e o dado dela continua guardado, sem que ninguém peça. Nada vaza e nada se perde: o pedido segue
`agendado`, a troca de nome é idempotente e a etapa 3 só vale inteira.

**Primeiro olhar:** o pedido e o job dele, só com ids, estados e datas (nunca nome nem texto):
`docker compose exec postgres psql -U educa -c "select p.id, p.eliminar_em, p.eliminacao_enfileirada_em, j.estado as job, j.tentativas, j.codigo_falha from pedido_titular p left join job_registro j on j.escola_id = p.escola_id and j.tipo = 'titular.eliminar' and j.dados->>'pedidoId' = p.id::text where p.escola_id = '<escola_id>' and p.estado = 'agendado' and p.eliminar_em <= now() order by p.eliminar_em"`.
O log do worker traz `titular.eliminacao` com o resultado (`concluida`, `sem_efeito`, `interrompida_pela_janela`) e, quando falha,
`job.tentativa_falhou` com o código e o erro resumido, nunca o texto trocado.

**Causas prováveis:**
1. A rotina da noite não enfileirou (`eliminacao_enfileirada_em` nulo e nenhum job) → a rotina `sistema.expurgar-dado-pessoal`
   não rodou ou falhou para a escola; veja "Rotina do sistema sem rodar". Com a rotina de volta, a noite seguinte enfileira.
2. O job está esperando vaga ou não foi despachado (`job` em `aguardando`, `reservado` ou `publicado`) → o `worker-lote` ou o
   `despachante` está parado, ou a escola está com o horário letivo aberto o dia todo e a fila de lote não roda; confira o
   horário letivo da escola antes de mexer em qualquer coisa.
3. A janela letiva abriu no meio da troca de nome em toda noite (`interrompida_pela_janela` sempre) → uma escola com tanto texto que
   a troca não termina fora do horário: a noite seguinte retoma do começo e só altera o que sobrou, então confira se o número de
   linhas trocadas por noite cai. Se não cai, abra correção: o tamanho da faixa e o índice parcial da 0036 são o que se ajusta.
4. A troca de nome quebrou o JSON de uma linha, ou o `eliminar` da pessoa falhou (`job.tentativa_falhou` com `22P02` ou o código do
   gatilho) em toda tentativa → o job esgota as tentativas e vira `falhou`; **a etapa 3 foi desfeita inteira**, e o pedido segue
   `agendado`. Não edite o texto à mão nem apague a pessoa: abra correção com o `sqlstate` e o `constraint` do `job.tentativa_falhou` e o `id` do pedido,
   nunca com a mensagem, o DETAIL nem o CONTEXT do Postgres, que citam o texto da linha; para achar a linha, use o `id` dela, sem
   colar o conteúdo. A rotina reenfileira com 20 h, então a correção publicada conclui sozinha.
5. O pedido foi concluído e a série continua → o `estado` já não é `agendado`: a medição está atrasada, ou o worker-lote não mede
   (log `worker.medicao_da_eliminacao_indisponivel`: o Postgres respondeu com erro). A série some na volta seguinte de 5 min.
6. A troca de nome passou do `statement_timeout` (`job.tentativa_falhou` com `sqlstate` `57014`) em toda tentativa → a escola tem
   linhas de texto muito grandes (material e apresentações em `consumo_ia` e `artefato`) e uma faixa não coube nos 2 s, mesmo com o
   teto de `ORCAMENTO_DA_FAIXA_EM_BYTES` (uma linha sozinha acima dele é o caso). Não suba o `statement_timeout` (regra 80, item 3):
   abra correção com o `id` do pedido, a tabela e o tamanho da maior linha (`octet_length`), nunca o conteúdo; a correção ajusta o
   orçamento ou a coluna.

**Se nada disso resolver:** a pessoa não se elimina à mão, nem o `estado` do pedido se muda por `update`: o caso de uso grava a
auditoria que responde "quem eliminou e quando" e anonimiza o que a pessoa fez. Escale ao dono do produto e avise a coordenação da
escola de que a eliminação atrasou, sem mandar o nome nem o pedido por mensagem.

**Depois:** registre no `TODO.md` a escola (id), o pedido (id), o `eliminar_em` e a causa, só com ids e datas. Causa nova vira
tarefa com teste que a reproduz.

## E-mail com falha acima de 20% em 1 h

**Dispara quando:** mais de 20% dos e-mails de convite que terminaram na última hora saíram `falhou`, por 5 min
(`(sum(increase(email_envio_total{resultado="falhou"}[1h])) / sum(increase(email_envio_total{resultado=~"enviado|falhou"}[1h]))) > 0.2`,
regra `infra/grafana/alertas/email-falhou.yaml`; Tech Spec de acesso-e-convites, seção 7c). A métrica é do job `email.enviar-convite`,
somadas as réplicas do worker de fila normal; a `nova_tentativa` (o 4xx que a fila repete), a `reserva_perdida` (a revogação venceu o envio),
o `ignorado` e o adiamento (`email_adiado_total`) não contam como desfecho. A série não leva escola nem convite: a escola vem do log do job.

**Impacto:** a coordenação clicou em "Enviar" e o professor não recebe o convite: a lista mostra "falhou" na linha, e ela pode usar "Reenviar" ou
"Copiar link" (o link copiado continua valendo). Nada fica pela metade: o convite `falhou` já não guarda o token nem o endereço cifrados.

**Primeiro olhar:** os convites `falhou` ainda não expurgados, só com ids e datas (nunca o endereço, que já foi apagado). O convite não guarda a hora em que virou
`falhou`, e um que falha agora pode ter sido criado horas antes (a fila repete o 4xx por até 24 h, o prazo do expurgo do envio parado); por isso a consulta olha as últimas
25 h pela criação, e o `criado_em` mais recente é o que o alerta contou:
`docker compose exec postgres psql -U educa -c "select id, escola_id, canal, envio, enviado_em, criado_em from convite where envio = 'falhou' and criado_em > now() - interval '25 hours' order by criado_em"`.
O `escola_id` da consulta é só para o time: não vai para mensagem fora dele (a coordenação é avisada pela tela, sem o id).
O log do worker traz `email.convite_falhou` com `conviteId`, `tentativa` e `tipo` (`permanente` é a recusa 5xx; `transitoria` é o 4xx ou a queda na última
tentativa), e `email.convite_nao_decifra` com a tentativa. Nenhum deles traz o endereço, o token nem a resposta do servidor.

**Causas prováveis:**
1. `tipo = permanente` em várias escolas → o provedor recusa o remetente, a credencial ou o domínio (SPF/DKIM): confira `EMAIL_SMTP_*` e `EMAIL_REMETENTE`
   no ambiente do worker e o painel do provedor. Corrigida a configuração, a coordenação reenvia pela tela.
2. `tipo = transitoria` na última tentativa → o provedor está lento ou fora (4xx, queda de conexão, 10 s estourados). Confira o status dele; o que o
   alerta mostra é o esgotamento das cinco tentativas, não uma só.
3. `email.convite_nao_decifra` → a `EMAIL_TOKEN_KEY` mudou com convites ainda na fila: a cifra não abre com a chave nova. Volte a chave anterior ou
   deixe os convites `falhou` e peça o reenvio; troca de chave recomeça o envio.
4. Poucos e-mails na hora → um ou dois `falhou` bastam para passar de 20%. Confira o número de envios da hora antes de escalar.

**Adiamento não é falha.** Com o teto `EMAIL_POR_MINUTO` gasto, o Redis de fila fora ou a reserva de outro processo vigente, o job é adiado (métrica
`email_adiado_total{motivo}`), sem gastar tentativa e sem virar `falhou`; ele volta sozinho no minuto seguinte (ou em 30 s, com o Redis fora). Adiamento
que não termina é visto na idade da fila `normal` ("Job interativo esperando" cobre a interativa; para a normal, veja `job_espera_mais_antiga_s`).

**O link da conta (o "esqueci a senha") entra na mesma métrica e no mesmo alerta.** O job `sistema.enviar-email-da-conta` não tem escola: a fila é a `normal`, a
vaga é a `vaga:normal:sistema`, e o log traz `email.link_da_conta_enviado`, `_adiado`, `_repetira`, `_falhou`, `_nao_enviado` e `_nao_decifra`, todos com `linkId` e
a tentativa, nunca o endereço, o token nem a resposta do servidor. O `falhou` do link não aparece em tela: a pessoa pede o link de novo, e o primeiro "esqueci"
da hora ainda vale 3 pedidos. A consulta é a mesma do convite, na outra tabela:
`docker compose exec postgres psql -U educa -c "select id, conta_id, finalidade, envio, criado_em from link_da_conta where envio = 'falhou' and criado_em > now() - interval '25 hours' order by criado_em"`.
O "esqueci" responde 202 igual a qualquer pedido; um pico de pedidos sem envio (`senha.link_na_fila` rarefeito no log) é o balde `rl:ip:senha` (10 por minuto por IP) ou o
teto de 3 por hora por e-mail fazendo o trabalho dele, e nunca vira 429.

**A cota do "Enviar convites" não é falha do envio.** A coordenação que recebe 429 gastou os 300 convites por hora da escola (`CONVITES_POR_HORA_POR_ESCOLA`); o
`Retry-After` diz quando a janela fecha, e o "Copiar link" segue valendo nesse meio-tempo. Com o Redis de fila fora, cada instância da API passa a valer
`300 ÷ instâncias` e o log traz `convites.cota_no_seguro_em_memoria` (só com os ids da requisição): trate como o Redis fora, não como abuso. A API também precisa da
`EMAIL_TOKEN_KEY` (a mesma do worker); sem ela a API não sobe.

**Se nada disso resolver:** avise a coordenação das escolas afetadas de que o e-mail não saiu e que o "Copiar link" entrega o mesmo convite pelo
canal que ela preferir. Não reenvie em massa enquanto o provedor estiver recusando: cada tentativa gasta um ponto do `EMAIL_POR_MINUTO`.

**Depois:** registre no `TODO.md` as escolas (ids), o `tipo` e a hora, só com ids e datas. Causa nova vira tarefa com teste que a reproduz.

## Pedido de IA acima do teto de entrada

**Dispara quando:** o gateway de IA recusou um pedido por estar acima do `maximoDeTokensDeEntrada` da tarefa, em qualquer tarefa e sem espera
(`sum by (tarefa) (increase(ia_pedido_acima_do_teto_total[10m]))` acima de zero; o gateway cria a série de cada tarefa em zero na subida, e por isso a primeira recusa conta; a exceção é a recusa que vier antes da primeira coleta do Prometheus depois de um restart: a série já nasce em 1 e o `increase()` não a conta, e o log `ia.geracao.pedido_acima_do_teto` a registra do mesmo jeito;
regra `infra/grafana/alertas/ia-pedido-acima-do-teto.yaml`; reengenharia-continuacao, tarefa 4.0). Não há taxa aceitável: a recusa só acontece com a entrada
**já válida** no esquema da tarefa, e por isso é defeito nosso, e não pedido de quem usa. Resolve sozinho 10 min depois da última recusa. A série soma as
instâncias e não leva escola, execução nem usuário: eles estão no log.

**Impacto:** a execução termina `falhou` com `PEDIDO_ACIMA_DO_TETO`, sem nada ter ido ao modelo, sem linha em `consumo_ia` e sem consumir o orçamento da escola. A tela
mostra "Tentar de novo" (a mensagem do catálogo, nunca o erro cru), e repetir dá o mesmo enquanto o teto não for corrigido. Quem pediu foi o Tutor, uma ferramenta
ou o Analista, conforme a `tarefa`. No Tutor a pergunta recusada **não conta** como troca do aluno (a execução `falhou` devolve a vez), e a regra fixa do assunto
delicado (D36) não passa pelo teto: o aluno continua recebendo o 188.

**Primeiro olhar:** o painel "Pedidos de IA recusados acima do teto de entrada, por tarefa" diz qual tarefa. O log da API traz, por recusa,
`ia.geracao.pedido_acima_do_teto` com `tipo` (a tarefa), `codigo`, `escolaId`, `execucaoId` e `duracaoMs`, nunca a entrada nem o prompt (veja "Buscar um erro no log pelo `tipo`").
A execução, só com ids: `docker compose exec postgres psql -U educa -c "select id, escola_id, tarefa, estado, erro, criada_em from execucao_agente where id = '<execucaoId do log>'"`.
O teste que confere cada teto com o pior pedido válido diz qual tarefa passou dele e por quanto: `npx vitest run --project unidade packages/core/src/ia/teto-de-entrada.test.ts`.

**Causas prováveis:**
1. O prompt ou um campo da tarefa cresceu e o `maximoDeTokensDeEntrada` dela não acompanhou (o teste acima falha, e a esteira o pega; chegar em produção quer dizer que a
   versão saiu sem ela) → corrija o número em `packages/core/src/ia/tasks/<tarefa>.ts` para o pior pedido que o teste imprime, com teste, e faça o deploy fora do horário letivo.
2. Um limite do esquema de entrada foi afrouxado (um `max` maior, um array maior) → o pior pedido válido cresceu: o teto sobe junto, ou o limite volta. Pedido válido que o modelo não
   comporta é decisão de produto, não só de teto: registre no `TODO.md` antes de subir o número.
3. O esquema passou a deixar entrar campo sem `max` → o gerador do pior pedido falha no teste (`EntradaSemLimiteError`); ponha o limite no campo, e não no teto.

**Se nada disso resolver:** avise a coordenação da escola afetada de que aquela ferramenta (ou o Tutor, ou o Analista) está fora até a correção, dizendo o que continua funcionando. Não
suba o teto de uma tarefa "para passar": o teto é o que o limitador e a estimativa da execução interrompida leem, e um número solto quebra a conta.

**Depois:** registre no `TODO.md` o nome da tarefa, a hora e quantas recusas (só o nome da tarefa e contagens, sem id de escola: o repositório é público). A causa vira tarefa com teste que a reproduz.

## Pergunta do Tutor cortada na espera em uma escola

**Dispara quando:** uma escola, e só uma, teve 3 ou mais perguntas do Tutor cortadas por esperar mais de 20 s na fila em 10 min
(`ia_espera_estourada_total`, o aumento por `escola_id` nos últimos 10 min, `>= 3`, e exatamente uma escola nessa condição; regra
`infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`; reengenharia-continuacao, tarefa 7.0). A métrica soma uma vez por pergunta, no instante em que o corte
grava `falhou IA_INDISPONIVEL`, pelo worker ou pelo `GET /v1/execucoes/:id`, e só a `interativa` tem esse corte: a `ferramenta` espera sem limite. Resolve sozinho 10 min depois do último corte.
Um restart do processo zera o contador dele e esconde o aumento daquela janela: o log `ia.execucao.espera_estourada` registra o corte do mesmo jeito.

**Impacto:** o aluno daquela escola viu "Tentar de novo" na pergunta que ficou mais de 20 s esperando, nada foi ao modelo e nada entrou em `consumo_ia`. A pergunta cortada **não conta**
como troca do dia (a execução `falhou` devolve a vez), e a reenviada conta. Da D36, a leitura por palavras continua (ela roda no `POST`, antes da fila); a leitura do modelo não roda nas perguntas cortadas. As outras escolas não sentem.

**Primeiro olhar:** o painel "Perguntas do Tutor cortadas por esperar mais de 20 s, por escola" e, na linha "Filas", "Vagas em uso" e "Espera do job mais antigo" da fila `interativa` dessa escola. O log da API e do
worker traz, por corte, `ia.execucao.espera_estourada` com `tipo`, `codigo`, `escolaId` e `execucaoId`, nunca o texto da pergunta (veja "Buscar um erro no log pelo `tipo`"). A execução, só com ids:
`docker compose exec postgres psql -U educa -c "select id, tarefa, estado, erro, criada_em, iniciada_em from execucao_agente where escola_id = '<escolaId do alerta>' and tarefa = 'turno_do_tutor' order by criada_em desc limit 20"`.

**Causas prováveis:**
1. A vaga da escola na `interativa` (`VAGAS_ESCOLA_INTERATIVA`, 10) está cheia: uma turma inteira perguntando junto, ou o modelo lento segurando as vagas → "Vagas em uso" no teto dela. Se a latência do provedor subiu, o problema é a conversa com ele, e não a vaga. Aumentar a vaga de uma escola é decisão, não correção de madrugada: registre.
2. O worker de IA dessa escola não está consumindo (`worker-ia-1`, `worker-ia-2`), ou uma execução `rodando` perdida segura a vaga até a varredura de 60 s a encerrar → `docker compose ps worker-ia-1 worker-ia-2` e os logs dos últimos 10 min.
3. O Redis de fila fora ou lento (`redis_disponivel{instancia="fila"}` em 0): vale para todas, e então o alerta "em várias escolas" dispara junto. Só esta escola é o sinal de que o problema é dela.

**Se nada disso resolver:** avise a coordenação da escola (seção "Como avisar as escolas") de que o Tutor está lento e de que "Tentar de novo" é seguro, e que nada do que o aluno escreveu se perde. Não aumente a vaga "para passar".

**Depois:** registre no `TODO.md` a hora e quantos cortes, só com contagens, sem id de escola: o repositório é público. A causa nova vira tarefa com teste que a reproduz.

## Pergunta do Tutor cortada na espera em várias escolas

**Dispara quando:** duas ou mais escolas tiveram, cada uma, 3 ou mais perguntas do Tutor cortadas por esperar mais de 20 s em 10 min
(`count(... >= 3)` acima de 1, sobre o mesmo aumento por `escola_id` da regra de uma escola; regra `infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`; reengenharia-continuacao, tarefa 7.0).
Resolve sozinho 10 min depois do último corte.

**Impacto:** é o sistema, e não uma escola: os alunos de várias escolas viram "Tentar de novo" na pergunta que passou de 20 s. Nada foi ao modelo, nada entrou em `consumo_ia`, e a troca não conta. Da D36, a leitura por palavras continua
(ela roda no `POST`, antes da fila); a leitura do modelo não roda nas perguntas cortadas. É o sintoma que mais aparece às 10h de segunda, com várias turmas perguntando juntas.

**Primeiro olhar:** "Perguntas do Tutor cortadas por esperar mais de 20 s, por escola" (quantas escolas, e desde quando), "Espera do job mais antigo" e "Vagas em uso" da fila `interativa`.
`docker compose ps worker-ia-1 worker-ia-2 despachante-1 despachante-2 redis-fila` e `docker compose logs --since 10m worker-ia-1 worker-ia-2`.

**Causas prováveis:**
1. O provedor de modelo lento ou recusando por limite → o limitador de tokens por minuto do gateway. O balde cheio é saturação: o horário de aula passou do contratado, e a conversa é com o provedor, não com o código.
2. Capacidade do worker de IA: as duas réplicas na CPU ou na memória, e a `interativa` com a fila crescendo para todas as escolas → `docker stats` e a espera do job mais antigo de cada escola.
3. O Redis de fila fora ou voltando (`redis_disponivel{instancia="fila"}`): os jobs chegam atrasados depois da volta, e o corte do `GET` já os encerrou. Passa sozinho quando a fila esvazia.
4. Uma escola com lote enorme tomando as vagas de todas → não deveria, as vagas são por escola; se acontecer, é defeito do despachante: veja "Job interativo esperando".

**Se nada disso resolver:** avise as coordenações afetadas, dizendo que o Tutor está lento e que "Tentar de novo" é seguro, e que a ferramenta do professor não tem esse corte. Não aumente vagas nem tokens por minuto sem decisão registrada.

**Depois:** registre no `TODO.md` quantas escolas, a hora e a causa, só com contagens, sem id de escola: o repositório é público. A causa nova vira tarefa com teste que a reproduz.

## Importação de planilha com falha acima de 20% em 1 h

**Dispara quando:** mais de 20% das importações de planilha que terminaram na última hora saíram `falhou`, por 5 min
(`(sum(increase(importacao_job_total{resultado="falhou"}[1h])) / sum(increase(importacao_job_total{resultado=~"concluida|desatualizada|falhou"}[1h]))) > 0.2`,
regra `infra/grafana/alertas/importacao-falhou.yaml`; Tech Spec do onboarding, seção 7c). A métrica é do job
`estrutura.gravar-planilha`, somadas as réplicas do worker de fila normal; a `ignorada` e a `nova_tentativa` não contam como
desfecho. A série não leva escola: a escola vem do log do job e de `importacao_planilha`.

**Impacto:** a coordenação gravou a planilha, viu "gravando" e a importação terminou `falhou`: a turma, o professor, a grade ou o
calendário não entraram, e ela precisa gravar de novo. Nada fica pela metade (o passo 3 é uma transação só); o dado da planilha
(`linhas` e `marcas`) já foi apagado.

**Primeiro olhar:** as importações `falhou` da hora, só com ids, tipo, código e datas (nunca a planilha, que já foi apagada):
`docker compose exec postgres psql -U educa -c "select id, escola_id, tipo, erro, criado_em, concluida_em from importacao_planilha where estado = 'falhou' and concluida_em > now() - interval '1 hour' order by concluida_em"`.
O log do worker traz `importacao.job_falhou` com `importacaoId`, `tentativa` e `codigo`, e `importacao.job_repetira` com o erro resumido.

**Causas prováveis:**
1. `erro = 'trava_esgotada'` em várias escolas → o passo 3 não conseguiu a trava em 1 s em todas as tentativas: outra escrita segura o ano, a
   importação ou as turmas (o gerar acesso das 7h30, a decisão em sala, um `desativar`). Veja "Passo 3 da importação acima de 1 s" e o
   `pg_locks` da hora; a coordenação grava de novo fora do pico.
2. `erro = 'expirou'` → a `na_fila` passou de 1 h sem o job pegá-la e o gravar seguinte, ou o expurgo da escola, a fechou. O job não está rodando:
   veja "Importação de planilha parada na fila" e "Job interativo esperando" (a fila é a `normal`).
3. `erro = 'erro_interno'` → falha definitiva ou tentativas esgotadas com outro erro: o log do worker traz `importacao.job_falhou` e
   `job.tentativa_falhou` com o código de erro (`sqlstate`, nunca o valor da linha). Erro de SQL que se repete em toda escola é defeito de
   código: abra correção com o `sqlstate`, o tipo da planilha e a versão, nunca a planilha.
4. Poucas importações na hora → uma ou duas falhas bastam para passar de 20%. Confira o número de importações da hora antes de escalar.

**Se nada disso resolver:** a importação não se conserta à mão: `importacao_planilha` não se altera por `update`, a coordenação grava de
novo pela tela. Avise a coordenação das escolas afetadas de que a planilha não entrou e pode ser enviada outra vez, sem pedir a planilha por
mensagem.

**Depois:** registre no `TODO.md` as escolas (ids), o tipo da planilha, o código do erro e a hora, só com ids e datas. Causa nova vira
tarefa com teste que a reproduz.

## Importação de planilha parada na fila

**Dispara quando:** a importação `na_fila` mais antiga de uma escola foi gravada há mais de 30 minutos, por 1 min
(`max by (escola_id) (importacao_minutos_na_fila{job="educa/worker"}) > 30`, regra `infra/grafana/alertas/importacao-parada.yaml`;
Tech Spec do onboarding, seção 7c). A métrica é o número de minutos desde o `criado_em` da `na_fila` mais antiga da escola em
`importacao_planilha`; o worker-lote a mede a cada 5 min, e o alerta traz o `escola_id`, nunca a importação nem quem a gravou. A escola
sem importação na fila não tem série, e ela some quando o job termina ou o expurgo a fecha. Com a medição a cada 5 min e o `for: 1m`, o alerta dispara entre 31 e 36 minutos depois da gravação.

**Impacto:** a coordenação gravou a planilha e a tela segue em "gravando". Uma escola só tem uma `na_fila`, então ela não consegue gravar
outra até esta terminar. Com 1 h, o gravar seguinte, ou o expurgo da escola à 1h, a fecha `falhou` e apaga as linhas: o dado de aluno da
planilha não fica parado por mais de cerca de 25 h.

**Primeiro olhar:** a importação e o job dela, só com ids, estados e datas:
`docker compose exec postgres psql -U educa -c "select i.id, i.tipo, i.criado_em, j.estado as job, j.codigo_falha from importacao_planilha i left join job_registro j on j.escola_id = i.escola_id and j.tipo = 'estrutura.gravar-planilha' and j.dados->>'importacaoId' = i.id::text where i.escola_id = '<escola_id>' and i.estado = 'na_fila' order by i.criado_em"`.

**Causas prováveis:**
1. O job está esperando vaga ou não foi despachado (`job_registro.estado` em `aguardando`, `reservado` ou `publicado`) → o worker da fila
   `normal` ou o `despachante` está parado; veja "Job interativo esperando" e "Job que falhou de vez". Com o worker de volta, o job conclui sozinho.
2. O Redis de fila se perdeu → o despachante republica o job pelo outbox (D49); confira o log do `despachante`.
3. O job está tentando de novo com a trava esgotada (`importacao.job_repetira` no log) → outra escrita segura o ano ou as turmas; veja
   "Passo 3 da importação acima de 1 s". Na última tentativa a importação sai `falhou` com `trava_esgotada`.
4. A importação já terminou e a série continua → o `estado` já não é `na_fila`: a medição está atrasada, ou o worker-lote não mede (log
   `worker.medicao_da_importacao_indisponivel`). A série some na volta seguinte de 5 min.

**Se nada disso resolver:** a importação não se fecha à mão: o expurgo da escola (à 1h) e o gravar seguinte fecham a de mais de 1 h
`falhou`. Avise a coordenação de que a planilha não entrou e pode ser enviada de novo depois disso, sem pedir a planilha por mensagem.

**Depois:** registre no `TODO.md` a escola (id), a importação (id), quando foi gravada e a causa, só com ids e datas. Causa nova vira
tarefa com teste que a reproduz.

## Passo 3 da importação acima de 1 s

**Dispara quando:** o p95 do passo 3 do job da planilha passa de 1 s, por 5 min
(`histogram_quantile(0.95, sum by (le) (rate(importacao_passo3_duracao_seconds_bucket{job="educa/worker"}[5m]))) > 1`, regra
`infra/grafana/alertas/importacao-passo3-lento.yaml`; Tech Spec do onboarding, seção 7c). O passo 3 é a transação curta que trava a
importação, o ano, os usuários, as contas e as turmas na ordem global e grava em lotes de 500. A série não leva escola.

**Impacto:** a planilha demora a entrar, e o passo 3 trava as turmas contra o gerar acesso das 7h30 e a decisão do professor em sala:
com ele acima de 1 s, essas duas esperam. O `lock_timeout` de 1 s e o `statement_timeout` de 1,5 s cortam o passo, a tentativa volta
inteira e o job repete; nada fica pela metade.

**Primeiro olhar:** o painel "Passo 3 da planilha (p95)" e a fila `normal` por escola; e as travas que seguram a transação:
`docker compose exec postgres psql -U educa -c "select a.pid, a.state, a.wait_event_type, a.wait_event, now() - a.xact_start as aberta_ha, left(a.query, 80) as comeco from pg_stat_activity a where a.wait_event_type = 'Lock' order by a.xact_start"`.

**Causas prováveis:**
1. Uma planilha grande de alunos com muitas turmas tocadas, junto com o gerar acesso → o passo trava as turmas em ordem de id num comando só;
   a espera é do gerar acesso, e termina quando o passo fecha. Se repetir toda segunda às 7h30, a coordenação deve gravar a planilha fora
   do pico; a regra da Tech Spec (seção 13) manda a spec voltar à revisão se o cenário [C] falhar.
2. Um `desativar` ou `eliminar` longo segurando a conta ou o usuário → `pg_stat_activity` mostra a transação aberta há muito tempo; ela não
   se mata à mão, e a tentativa do job repete sozinha.
3. O banco está lento em geral → veja "Taxa de erro 5xx" e "Login lento": o passo 3 é só o primeiro a sentir.
4. O índice de uma tabela que o passo lê se perdeu (plano com `Seq Scan` na `lista_nome`, no `vinculo` ou na `turma`) → `explain` da
   consulta do log do Postgres; abra correção com o plano, nunca com os valores.

**Se nada disso resolver:** não suba o `statement_timeout` nem o `lock_timeout` do passo (regra 80, item 3): o corte é o que protege o gerar
acesso. Escale ao dono do produto e peça à coordenação que grave fora do horário letivo enquanto isso.

**Depois:** registre no `TODO.md` o horário, o tipo da planilha, o número de linhas e a causa, sem planilha. Causa nova vira tarefa com
teste que a reproduz.

## Extração de PDF parada

**Dispara quando:** o job `pdf` mais antigo que ainda não começou espera há mais de 15 min **e** nenhuma extração terminou (`pronto` ou `falhou`) nos
últimos 15 min, por 1 min (`max(job_espera_mais_antiga_s{fila="pdf"}) and on () ((sum(increase(material_extracao_total{job="educa/worker", resultado=~"pronto|falhou"}[15m])) or vector(0)) == 0)`
acima de 900, regra `infra/grafana/alertas/pdf-parado.yaml`; Tech Spec da ingestão do material, seção 7c). Os dois termos valem juntos: fila cheia com extração
andando (as 300 apostilas do onboarding esperam horas) não dispara, e o primeiro PDF depois de horas sem nenhum também não, porque espera segundos.
`sem_efeito`, `arquivo_ausente` e `nova_tentativa` não contam como extração terminada. A série não leva escola.

**Impacto:** a coordenação enviou o PDF e o material fica em "processando": não vira texto, e nenhuma ferramenta nem o Tutor o usa. O PDF espera no storage
privado; nada se perde. Job que **nunca rodou** fica `aguardando` até rodar, e este alerta é o único aviso: não há prazo automático para o PDF dele.

**Primeiro olhar:** a réplica e a fila, só com ids e datas: `docker compose ps worker-pdf` e
`docker compose exec postgres psql -U educa -c "select id, escola_id, estado, criado_em from job_registro where fila = 'pdf' and estado not in ('concluido', 'falhou') order by criado_em limit 20"`.
O log do `worker-pdf` traz `material.extraido`, `material.extracao_falhou` e `material.extracao_repetira` (`materialId`, `tentativa`, nunca título nem texto), e o
painel "Fundação — rota, fila e escola" mostra a espera da fila `pdf`.

**Causas prováveis:**
1. O `worker-pdf` está parado ou reiniciando em laço (`docker compose ps`) → `docker compose up -d worker-pdf`; confira `docker compose logs --since 10m worker-pdf`.
   Sem `STORAGE_*` ele não sobe: a mensagem cita só o nome da variável.
2. O storage sem espaço (o PDF fica no storage privado até a extração, em `material-temporario/`; com a fila parada ele só cresce, e o pior caso, as
   300 apostilas de 20 MB das dez escolas do primeiro ano esperando juntas, é de cerca de 60 GB, `docs/infra.md` seção 3.5) → `df -h` do volume do storage
   (`storage-dados`); libere espaço (backup antigo, objeto de teste) e suba o `worker-pdf`: a fila anda e cada objeto sai depois de extraído.
3. O job está esperando vaga: a escola tem 2 PDFs em extração e a vaga `pdf` está tomada por um que passou do prazo → a `pdf` devolve o job da réplica
   morta em até 80 s (lock de 60 s, verificação de 20 s); passando disso, veja "Job interativo esperando" (mesma vaga por escola) e a liberação da vaga.
4. O despachante está parado ou o Redis de fila se perdeu → o job fica `aguardando` ou `publicado` sem andar; veja "Job interativo esperando" e "Job que falhou de vez" (o despachante republica pelo outbox, D49).
5. O job falhou de vez e o material ficou `processando` com o PDF (a réplica morreu na última tentativa) → o alerta "Job que falhou de vez" dispara junto;
   use `ops:descartar-job` (seção "Reprocessar ou descartar um job que falhou"): fecha o material e apaga o PDF.

**Se nada disso resolver:** não apague a linha do job nem o objeto à mão. Avise a coordenação das escolas com material `processando` de que o envio está
atrasado e que o arquivo não precisa ser enviado de novo (seção "Como avisar as escolas"); se for um PDF que trava a extração (o `worker-pdf` reinicia ao
chegar nele), descarte o job pelo comando e peça à escola que envie o arquivo de novo.

**Depois:** registre no `TODO.md` a hora, o que parou e quantos jobs esperaram, só com ids e contagens. Causa nova vira tarefa com teste que a reproduz.

## Classificação do material atrasada

**Dispara quando:** a escola tem execução da classificação do material (`execucao_agente.tarefa = 'classificar_secoes'`) que **`falhou` durante a noite** (entre o fecho e a abertura da janela letiva dela) ou que ficou **`pendente` desde antes da noite**,
por 1 min (`max by (escola_id) (classificacao_execucoes_atrasadas{job="educa/worker"}) > 0`, regra `infra/grafana/alertas/classificacao-atrasada.yaml`; Tech Spec da classificacao-bncc, seção 7c). O worker-lote mede a cada 5 min, no fuso e
no horário da escola; a série traz o `escola_id`, nunca a execução, a seção nem o material. A `pendente` criada na própria noite (o excedente de uma escola que entra com 300 apostilas) não conta: a noite seguinte a termina.
A medição vale o dia inteiro, e na abertura seguinte a noite que se julga é outra. Sem execução atrasada a escola não tem série.

**Impacto:** o material novo da escola fica sem habilidade da BNCC (`nao_agendada`, `aguardando` ou `nao_classificada`). Nada quebra e nada vai ao aluno: a ferramenta gera a questão sem habilidade e o diagnóstico mostra "Sem habilidade", até a
classificação terminar. A coordenação vê o aviso no painel do material e pode corrigir à mão.

**Primeiro olhar:** as execuções da escola, só com ids, estados, códigos e datas (nunca título nem texto):
`docker compose exec postgres psql -U educa -c "select id, estado, erro, criada_em, concluida_em from execucao_agente where escola_id = '<escola_id>' and tarefa = 'classificar_secoes' and (estado = 'falhou' or criada_em > now() - interval '3 days') order by criada_em desc limit 40"`,
e quantas seções estão em cada estado: `select (execucao_id is null) as sem_execucao, falhas_seguidas, count(*) from secao_do_material where escola_id = '<escola_id>' and corrigida_em is null group by 1, 2`. A coluna `erro` guarda só o código do erro (`IA_SAIDA_INVALIDA`, `EXECUCAO_INTERROMPIDA`…), nunca texto livre nem conteúdo de seção: não a troque por uma coluna de texto livre nem copie o que o modelo devolveu para ela. O log do `worker-ia` traz
`ia.execucao.falhou` com o código e a tarefa; o do `worker-lote`, `classificacao.agendada` (lotes, execuções e seções do job da noite, e o estado em que parou: `fim`, `limite`, `suspensa` ou `sinal`). O painel "Fundação — rota, fila e escola" mostra a espera
da classificação (p95) e a vazão do balde `lote`.

**Causas prováveis:**
1. O provedor de IA está fora ou o balde `lote` está cheio → as execuções voltam a `pendente` e o job é adiado, sem gastar tentativa (`ia.execucao.adiada_pelo_provedor`). É o caso mais comum de `pendente` antiga: com o provedor de volta
   elas rodam sozinhas, **fora do horário letivo da escola** (o job que volta na janela é adiado até o fim dela: `ia.execucao.adiada_pela_janela`). Veja "Provedor de IA fora" e o painel de IA.
2. A escola entrou com muito material de uma vez (onboarding de 300 apostilas, 630 execuções, ~2,4 h medidas em 18/11/2026 com 31 mil tokens por execução; o balde `lote` e a vaga por escola, `VAGAS_ESCOLA_LOTE`, dividida com o expurgo e a eliminação, é quem regula). O job da noite cria no máximo
   `EXECUCOES_POR_NOITE_DA_ESCOLA` (1.000) execuções, e o resto sai na noite seguinte (`classificacao.agendada` com `estado: limite`): não é falha, e o alerta some quando a noite seguinte termina.
3. Troca de prompt ou de modelo que reprova a saída em massa (`IA_SAIDA_INVALIDA` em quase toda execução) → cada seção que falhou soma 1 em `falhas_seguidas` e **vai numa execução só dela** na noite seguinte; uma escola de 300 apostilas passa de 630 para até
   1.000 execuções numa noite (o limite do job da escola, `EXECUCOES_POR_NOITE_DA_ESCOLA`; o que passar dele sai nas noites seguintes), contidas pelo balde, pelo adiamento e pelo teto de 3 noites (a quarta não chama o modelo). Pare a perda: **suspenda a função** `classificacao_do_material` na escola (a coordenação, pela tela de governança, ou o comando D76 com chamado)
   e avise o Arquiteto; a seção com 3 falhas só volta quando a coordenação a reclassifica.
4. A recusa de soberania (`IA_INDISPONIVEL` com motivo `soberania`: o provedor não tem processamento no Brasil, D62) falha a execução **sem adiar**, e repete **toda noite** para toda escola → confira `docker compose logs --since 1h worker-ia | grep soberania`
   e o cadastro do suboperador; a classificação só volta com o provedor ou o adaptador local conferido. Não troque a configuração para "passar".
5. `EXECUCAO_INTERROMPIDA` recorrente (o worker morre no meio da chamada, ou a chamada passa de 300 s) → `docker compose ps worker-ia` e o log com `worker_ia.desligamento_forcado` e `ia.execucao.interrompida`; a execução volta a `falhou` sem somar `falhas_seguidas` e a rotina a agenda
   de novo. Se repetir noites seguidas para uma escola, suspenda a função nela ou use o D76 com chamado, e abra a correção.
6. A função está suspensa na escola → a rotina não agenda (`classificacao.agendada` com `estado: suspensa`), as seções ficam `nao_agendada` e o alerta só dispara pelo que sobrou antes da suspensão. Retomada a função, a rotina das 19h agenda.
7. O `worker-lote` não roda a rotina → sem `classificacao.rotina_disparada` às 19h no log dele, olhe "Job que falhou de vez" e o agendador (`agendamentos.registrados` no boot).

**Se nada disso resolver:** não apague execução nem seção à mão, e não marque a seção como classificada: a coordenação corrige a habilidade na tela do material (a correção vence), e a geração segue sem habilidade onde ela falta. Avise a coordenação das escolas
com material novo de que a classificação está atrasada e que a habilidade da questão aparece depois (seção "Como avisar as escolas").

**Depois:** registre no `TODO.md` a escola, a noite, quantas execuções e a causa, só com ids e contagens. Causa nova vira tarefa com teste que a reproduz. Falha em massa depois de troca de prompt entra na retro da funcionalidade.

## Turma sem material da série

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. O painel "Fundação — rota, fila e escola" tem o gráfico "Perguntas do Tutor recusadas por
falta de material da turma" (`tutor_recusa_sem_material_total`, por `turma_id`; ingestão do material, tarefa 9.0).*

**O que significa:** o aluno da turma pergunta ao Tutor e a série dela não tem material **pronto** de hoje: o único material
declarado para a série venceu (licença), está `processando`, foi substituído ou nunca existiu. A recusa é `SEM_MATERIAL_DA_SERIE`, dada antes de gastar modelo, e
o aluno vê "Avise seu professor". É o comportamento certo; o gráfico só mostra quem está sem Tutor útil. **O gráfico conta só o Tutor**: a professora que pede atividade, plano ou chat sem
material da série recebe a mesma recusa na tela dela, e isso não entra na conta.

**Primeiro olhar:** só ids e datas. Quais materiais a série tem e em que estado:
`docker compose exec postgres psql -U educa -c "select m.id, m.estado, m.titularidade, l.vigente_ate from material m join material_serie ms on ms.escola_id = m.escola_id and ms.material_id = m.id left join licenca_de_material l on l.escola_id = m.escola_id and l.id = m.licenca_id where m.escola_id = '<escolaId>' and ms.serie_id = '<serieId>' and m.excluido_em is null"`.

**Causas e o que fazer:**
1. Licença vencida de material de terceiro → a coordenação registra a licença nova ou estende a vigência (`PATCH /v1/licencas/:id`); a leitura volta no mesmo dia, sem reprocessar nada.
2. Material em `processando` → veja "Extração de PDF parada" e "Job que falhou de vez".
3. Material nunca declarado para a série (o envio sem série) → hoje a série só se declara no envio: a coordenação envia o arquivo de novo (`POST /v1/materiais`) com a série marcada e exclui
   o envio sem série (`DELETE /v1/materiais/:id`). Corrigir as séries sem reenviar o arquivo chega com o painel do material (tarefa 12.0).

**Depois:** nada a registrar quando é só uma turma que ainda não recebeu material. Se várias turmas somem juntas, é licença vencida em lote: avise a coordenação.

## Voltar o código com eliminação agendada em curso (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para qualquer volta de versão que passe pela migration
`0035_eliminacao_agendada` (F3, tarefa 14.0; Tech Spec do F3, seção 5).*

**O que a migration deixou:** a coluna `usuario.eliminacao_agendada_em` (a data do registro da eliminação), o estado
`pedido_titular.estado = 'agendado'` (com `eliminar_em` e a trava de um por titular) e o motivo de sessão `eliminacao_agendada`.
Tudo só expande: o código anterior roda sobre ela sem erro. **Não reverta a 0035**: apagar a coluna, o estado ou o motivo
com pedido em curso apaga a única marca de que aquela pessoa não pode entrar.

**O que o código anterior faz com elas:** ignora a coluna. Ele não conhece o `agendado`, não recusa o login, a renovação nem a
guarda do usuário com a eliminação agendada, e não pula esse usuário no expurgo de `pessoa_desativada`. Durante a volta, quem
tinha pedido agendado **entra de novo**, e o prazo de 7 dias (que é o do banco, em `eliminar_em`) segue correndo.

**Antes de voltar:** liste o que está agendado, só ids e datas (nunca nome nem matrícula):
`docker compose exec postgres psql -U educa -c "select p.escola_id, p.id as pedido_id, p.titular_id, p.registrado_em, p.eliminar_em from pedido_titular p where p.estado = 'agendado' order by p.eliminar_em"`.
Nenhum desses pedidos se cancela nem se conclui à mão. Se a volta passa de algumas horas, avise a coordenação de cada escola da
lista (ela é quem cancela pela tela) de que, até a versão voltar, a pessoa não está com o acesso suspenso.

**Na volta para a versão nova (roll-forward):** a marca continua na coluna. A guarda, a renovação, o login e o seletor voltam a
recusar sozinhos, sem comando: a sessão que a pessoa abriu enquanto o código anterior rodava deixa de valer na próxima
requisição (a guarda lê a marca, não só a sessão). O prazo de `eliminar_em` não se move: o pedido
`agendado` cujo prazo venceu durante a volta é o que a rotina da noite enfileira e o job `titular.eliminar` (tarefa 15.0) elimina na
primeira passada depois dela.

**Não faça:** gravar `eliminacao_agendada_em` à mão (a marca é espelho do pedido, e o cancelamento a apaga junto), nem mudar o
`estado` do pedido por `update`: o cancelamento e a conclusão pelo caso de uso gravam a auditoria que responde "quem cancelou e
quando".

**Depois:** registre no `TODO.md` a janela (de quando a quando), as escolas avisadas e quantos pedidos `agendado` estavam em curso,
só com ids e datas.

## Voltar o código com pedidos de conta da escola pendentes (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para qualquer volta de versão que passe pela migration
`0047_reivindicacao_conta` (acesso-e-convites, tarefa 14.0; Tech Spec, seção 3).*

**O que a migration deixou:** a coluna `reivindicacao.conta_externa`, o único parcial `reivindicacao_conta_pendente_unica` e o check
`reivindicacao_segredo_so_pendente` trocado (pendente tem hash **ou** conta). Tudo só expande: o código anterior roda sobre isso sem
erro. **Não reverta a 0047**: o check antigo exige `senha_hash` no pendente, e o pedido de conta que já está lá o violaria.

**O que o código anterior faz com eles:** ele lê o pedido pendente esperando o hash da senha. O pedido de conta não tem hash, e a
aprovação dele cai no `InvariantException` (5xx) em vez de criar o aluno. O aluno que já foi aprovado pela conta não é afetado: entra
pelo login externo, que não mudou.

**Antes de liberar a versão anterior:** encerre os pedidos de conta pendentes, sem decisão (encerrar não é decidir, regra 70, item 2),
e devolva o nome à lista para o aluno pedir de novo, agora com senha. Numa transação só:

```
docker compose exec postgres psql -U educa -1 -c "with encerrados as (
  update reivindicacao set estado = 'encerrada', conta_externa = null, chave_envio = null, teve_matricula_errada = null
  where estado = 'pendente' and conta_externa is not null
  returning escola_id, lista_nome_id
)
update lista_nome l set estado = 'livre' from encerrados e where l.escola_id = e.escola_id and l.id = e.lista_nome_id"
```

Confira depois, só com contagens: `select count(*) from reivindicacao where estado = 'pendente' and conta_externa is not null` volta zero.

**Na volta para a versão nova (roll-forward):** nada a refazer. O aluno cujo pedido foi encerrado abre a página da sala e prova a conta de
novo, ou pede com senha.

**Não faça:** apagar o check ou a coluna para "passar" a versão anterior, nem aprovar à mão o pedido de conta.

**Depois:** registre no `TODO.md` a janela (de quando a quando) e quantos pedidos foram encerrados, só contagens.

## Voltar o código depois da chave da turma (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para qualquer volta de versão que passe pela migration
`0040_f2_planilhas` (F2, tarefa 2.0; Tech Spec do F2, seção 3).*

**O que a migration deixou:** as tabelas `importacao_planilha`, `alocacao` e `evento_calendario`, a coluna `turma.chave` (com o único
parcial `turma_chave_no_ano_unica`), a coluna `vinculo.origem` (padrão `coordenacao`) e o único `vinculo_escola_ano_id_unico`. Tudo só
expande: o código anterior roda sobre isso sem erro. **Não reverta a 0040**: apagar `turma.chave` ou o índice desfaz a única coisa
que impede "8º A" e "8A" de virarem duas turmas depois que o código novo voltar.

**O que o código anterior faz com elas:** ignora tudo. Ele cria e renomeia turma **sem calcular a `chave`**: a turma criada nesse
tempo fica com a chave nula, e a renomeada fica com a chave **do nome antigo**. A planilha de alunos só chega com o código novo, então
nada importa errado durante a volta; o estrago é a chave desatualizada quando o código novo voltar.

**Na volta para a versão nova (roll-forward), antes de liberar a planilha:** recalcule a chave de todas as turmas, na mesma conta
da migration, só onde ela é única no ano. Duas turmas do mesmo ano que o código anterior deixou com a mesma chave ficam as duas sem
chave (a prévia as acusa como erro e a coordenação renomeia uma delas):

```
docker compose exec postgres psql -U educa -1 -c "update turma set chave = null where chave is not null;
with calculada as (
  select id, escola_id, ano_letivo_id,
    regexp_match(lower(translate(btrim(nome), 'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇ', 'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuucc')), '^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$') as achado
  from turma
), com_chave as (
  select id, escola_id, ano_letivo_id, achado[1] || achado[3] as chave from calculada where achado is not null
), unica as (
  select id, chave from (select id, chave, count(*) over (partition by escola_id, ano_letivo_id, chave) as total from com_chave) contada where total = 1
)
update turma set chave = unica.chave from unica where turma.id = unica.id"
```

O `-1` roda tudo numa transação: o `update` que zera e o que recalcula entram juntos, ou nenhum entra. Confira depois, só com contagens:
`select count(*) filter (where chave is null) as sem_chave, count(*) as total from turma`.

**Não faça:** escrever `chave` à mão, nem apagar o índice para "passar" uma duplicata: a duplicata é erro de planilha, e o lugar de
resolvê-la é a coordenação, renomeando a turma.

**Depois:** registre no `TODO.md` a janela (de quando a quando) e quantas turmas ficaram sem chave por repetição, só contagens.

## Voltar o código depois da F4 (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para qualquer volta de versão que passe pelas migrations
`0049` a `0056` (ingestão do material, F4; tarefas 1.0 a 8.0; Tech Spec da ingestão, seções 3 e 5), e também pela `0065` (a contração da F4, classificacao-bncc, tarefa 9.0: veja "A `0065`" abaixo). O que o teste prova está em
`packages/core/src/db/volta-da-f4.int.test.ts`, que roda os dois blocos de SQL desta seção, e em `packages/core/src/db/contracao-da-f4.int.test.ts`, que roda o bloco "volta ao código da F4".*

**A `0065` fecha esta volta, a menos do passo extra dos blocos.** Ela deixou no banco o check `material_terceiro_tem_licenca` (todo material de terceiro leva `licenca_id`, e só ele) e tirou os dois checks de `licenciante`; o código anterior à F4 grava o material de terceiro com o `licenciante` na linha e **sem** `licenca_id`, e o banco o recusaria. Por isso o bloco 1 solta o check antes de o código anterior subir, copia o `licenciante` da licença para a linha do material que ficou sem ele (o código de hoje não o grava) e o bloco 2 o põe de volta depois de ligar o material à licença. O código da F4 anterior à 9.0 (o que grava `licenca_id` e `licenciante`) **sobe sem soltar o check**, que ele cumpre, mas **lê** o licenciante da linha do material, e o código da 9.0 deixou de gravá-lo: todo material de terceiro enviado ou editado desde o deploy da 9.0 aparece à coordenação sem o nome do licenciante. Por isso, antes de subir esse código, rode o bloco "volta ao código da F4" abaixo, com `psql -1`; é a mesma cópia que o bloco 1 faz, sem soltar o check. **Depois do `DROP COLUMN material.licenciante`** (`TODO.md`, deploy seguinte à 9.0) **a volta para antes da F4 deixa de existir**: o código anterior lê a coluna, e esta seção sai do runbook com ele.

```sql
-- volta-da-f4: volta ao código da F4 (anterior à 9.0), antes de subir
update material m set licenciante = l.licenciante
  from licenca_de_material l
 where l.escola_id = m.escola_id and l.id = m.licenca_id and m.licenciante is null;
```

**O que as migrations deixaram:** as colunas `material.processado_em`, `objeto_apagado_em`, `licenca_id`, `edicao`, `substitui_id` e
`substituido_por`, as tabelas `capitulo_do_material`, `licenca_de_material`, `material_serie` e `envio_de_material`, o índice
`material_uma_edicao_em_andamento`, a fila `pdf` em `job_registro` e o `material.substituido` no check da auditoria. Tudo só expande: o
código anterior roda sobre isso sem erro. **Não reverta nenhuma delas**: apagar `licenca_id` ou `material_serie` tira da busca e do
Tutor a única marca do que a licença cobre e de que série o material é.

**O que o código anterior faz com elas:**

- **Os jobs `pdf`** (`aguardando`, `reservado`, `publicado`, `ativo`): o despachante anterior não conhece a fila `pdf` e não os reserva. Se ficarem
  em `job_registro`, voltam a andar no worker novo e leem o PDF de um material que o código anterior já fechou como `falhou`. Por isso o bloco 1 os
  conclui todos, e nenhum job `pdf` sobrevive à volta.
- **O material `processando`**: o código anterior lia o PDF dentro da API, e não o lê mais do storage. A varredura dele (`varrerParados`, a
  cada 60 s) passa para `falhou` com `extracao_falhou` o que está `processando` há mais de quatro prazos de extração, **sem** gravar
  `processado_em`. É o estrago: o PDF desse material fica no storage sem ninguém que o apague, porque a varredura do worker novo
  (`objetosQueSobraram`) só olha o material que já saiu de `processando` **com** `processado_em` ou excluído. Por isso o bloco 1, abaixo,
  fecha os `processando` antes de o código anterior subir, e grava o `processado_em`.
- **A edição `processando`** é um material `processando` como os outros: fechada como `falhou`, ela libera o índice
  `material_uma_edicao_em_andamento`, e o material que ela ia substituir segue `pronto` e na busca. Nada se perde.
- **A linha de `envio_de_material`**: o código anterior não a conhece e não a lê. Fica onde está; a varredura de 61 minutos do worker novo apaga a
  linha e o objeto que sobraram, depois do roll-forward. **Não apague a tabela nem as linhas à mão**: elas são o único jeito de achar um PDF sem dono.
- **O material enviado durante a volta** nasce sem série (`material_serie`), e o de terceiro, com o `licenciante` na linha e sem `licenca_id`. Ele
  aparece na busca de toda a escola enquanto não houver série, e o aviso de vencimento não o alcança. É o que o bloco 2 conserta no roll-forward.

**Antes de voltar:** pare a API, o `worker-pdf` e o worker de lote (nenhum deles pode tomar um job no meio do passo), e rode o bloco 1 numa
transação, na entrada do `psql`: `docker compose exec -T postgres psql -U educa -1 -v ON_ERROR_STOP=1`. Ele solta o check da `0065`, copia o licenciante da licença para o material de terceiro que ficou sem ele, fecha como `falhou`, com
`extracao_falhou` (nenhum valor novo em `falha`, que o código anterior não conhece) e com `processado_em`, os materiais `processando`, e conclui os jobs `pdf` que não terminaram (`aguardando`, `reservado`, `publicado` e `ativo`). Só então suba o código anterior. A coordenação vê "o arquivo não foi lido" no material fechado e envia de novo.

```sql
-- volta-da-f4: bloco 1, antes de subir o código anterior
alter table material drop constraint if exists material_terceiro_tem_licenca;
update material m set licenciante = l.licenciante
  from licenca_de_material l
 where l.escola_id = m.escola_id and l.id = m.licenca_id and m.licenciante is null;
update material set estado = 'falhou', falha = 'extracao_falhou', processado_em = now()
 where estado = 'processando' and excluido_em is null;
update job_registro set estado = 'concluido', concluido_em = now()
 where fila = 'pdf' and estado in ('aguardando', 'reservado', 'publicado', 'ativo');
```

Confira depois, só com contagens: `select count(*) filter (where estado = 'processando') as processando from material where excluido_em is null`
deve dar 0, e `select count(*) from job_registro where fila = 'pdf' and estado not in ('concluido', 'falhou')`, também.

**Na volta para a versão nova (roll-forward), antes de reabrir o envio:** rode o bloco 2, também com `psql -1`. Ele dá a todo material que
nasceu sem série **todas as séries da escola** (a mesma conta da `0055`), e liga o material de terceiro sem `licenca_id` à licença da
escola com o mesmo `licenciante`, ou cria uma "registrada durante a volta do código", com o começo no `enviado_em` mais antigo (a mesma conta da `0053`). No fim, põe de volta o check da `0065` (`NOT VALID` e `VALIDATE`): material de terceiro sem licença não fica no banco.
Depois suba o worker: nenhum job `pdf` da época da volta existe mais (o bloco 1 os concluiu), os envios novos entram na fila `pdf` normalmente, e a varredura de 61 minutos limpa o que sobrou no storage.

```sql
-- volta-da-f4: bloco 2, no roll-forward
insert into material_serie (escola_id, material_id, serie_id)
select m.escola_id, m.id, s.id
  from material m join serie s on s.escola_id = m.escola_id
 where not exists (select 1 from material_serie ms where ms.escola_id = m.escola_id and ms.material_id = m.id);
insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate)
select m.escola_id, m.licenciante, 'Materiais enviados com o código anterior', 'registrada durante a volta do código',
       (min(m.enviado_em) at time zone 'America/Sao_Paulo')::date,
       case when bool_and(m.excluido_em is not null) then (max(m.excluido_em) at time zone 'America/Sao_Paulo')::date end
  from material m
 where m.licenciante is not null and m.licenca_id is null
   and not exists (select 1 from licenca_de_material l where l.escola_id = m.escola_id and l.licenciante = m.licenciante)
 group by m.escola_id, m.licenciante;
update material m set licenca_id = (
  select l.id from licenca_de_material l
   where l.escola_id = m.escola_id and l.licenciante = m.licenciante order by l.vigente_desde desc, l.id limit 1)
 where m.licenca_id is null and m.licenciante is not null;
alter table material drop constraint if exists material_terceiro_tem_licenca;
alter table material add constraint material_terceiro_tem_licenca
  check ((titularidade = 'terceiro_com_licenca') = (licenca_id is not null)) not valid;
alter table material validate constraint material_terceiro_tem_licenca;
```

Se a licença que o bloco 2 ligou a um material já está vencida, o material sai da busca: a coordenação a estende em Licenças, e ele volta sem
reenviar (RF17).

**Não faça:** apagar `substitui_id`, `substituido_por` ou o índice para "passar" a versão anterior; gravar um `falha` que não seja um dos três
códigos que o código anterior conhece (`arquivo_invalido`, `sem_texto`, `extracao_falhou`), porque a lista de materiais dele **recusa a
resposta inteira** com um valor que não conhece; apagar o objeto em `material-temporario/` à mão; rodar o bloco 2 sem o 1 já ter fechado os `processando`.

**Depois:** registre no `TODO.md` a janela (de quando a quando), quantos materiais o bloco 1 fechou e quantos receberam série e licença
no bloco 2, só contagens, e avise a coordenação das escolas que tinham material em "processando".

## Voltar o código depois da classificacao-bncc 2.0 (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para qualquer volta de versão que passe pelas migrations `0060` e
`0061` (as seções do material; classificacao-bncc, tarefa 2.0; Tech Spec, seções 3 e 5). O que o teste prova está em
`packages/core/src/db/volta-da-2-0.int.test.ts`, que roda o bloco de SQL desta seção.*

**O que as migrations deixaram:** as tabelas `secao_do_material` e `habilidade_da_secao`, o `unique (escola_id, id)` de `capitulo_do_material`, os
três índices e a ação `material.classificacao_herdada` no check `auditoria_rotina_so_nas_acoes`. Tudo só expande: o código anterior roda sobre isso
sem erro. **Não reverta nenhuma delas**: a tabela guarda, a partir da 7.0, a correção que a coordenação fez das habilidades de cada seção, e apagá-la
perde esse trabalho.

**O que o código anterior faz com elas:** nada. Ele não conhece as tabelas, então o material que fica `pronto` pela extração dele (a de um PDF novo e a
de uma edição) nasce **sem seção**, e a edição nova **não herda** a correção da anterior. A `0061` roda uma vez só, no deploy: nada no sistema cria a
seção de um material que fique `pronto` depois dela. Sem o roll-forward abaixo, esse material fica sem seção para sempre, e a classificação noturna (5.0)
não o alcança.

**Antes de voltar:** não há passo. Nenhum job novo existe nesta tarefa (a classificação é da 5.0), e o código anterior sobe sobre o que está no banco.

**Na volta para a versão nova (roll-forward), antes de reabrir o envio:** rode o bloco abaixo uma vez, na entrada do `psql`:
`docker compose exec -T postgres psql -U educa -1 -v ON_ERROR_STOP=1`. É o mesmo `INSERT … NOT EXISTS` da `0061`, em uma instrução só: dá, ao material `pronto` e
não excluído que está sem nenhuma seção, uma seção por capítulo, ou um bloco por 10 páginas (o último com as que sobram), **sem execução**, pela mesma
conta de `planejarSecoes`. Pode rodar de novo: o material que já tem seção não ganha outra. O material de que o código anterior fez a edição não herda a
correção da anterior (a herança é da extração nova, e não se refaz depois): a coordenação a corrige outra vez na tela da classificação (7.0).

```sql
-- volta-da-2-0: roll-forward
insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final)
select c.escola_id, c.material_id, c.id, c.ordem, c.pagina_inicial, c.pagina_final
  from capitulo_do_material c
  join material m on m.escola_id = c.escola_id and m.id = c.material_id
 where m.estado = 'pronto' and m.excluido_em is null
   and not exists (select 1 from secao_do_material s where s.escola_id = m.escola_id and s.material_id = m.id)
union all
select m.escola_id, m.id, null::uuid, b.n::smallint, (b.n - 1) * 10 + 1, least(b.n * 10, m.paginas)
  from material m
 cross join lateral generate_series(1, (m.paginas + 9) / 10) as b(n)
 where m.estado = 'pronto' and m.excluido_em is null
   and not exists (select 1 from capitulo_do_material c where c.escola_id = m.escola_id and c.material_id = m.id)
   and not exists (select 1 from secao_do_material s where s.escola_id = m.escola_id and s.material_id = m.id);
```

Confira depois, só com contagens: `select count(*) from material m where m.estado = 'pronto' and m.excluido_em is null and not exists (select 1 from
secao_do_material s where s.escola_id = m.escola_id and s.material_id = m.id)` deve dar 0.

**Não faça:** apagar `secao_do_material`, `habilidade_da_secao` ou o `unique` do capítulo para "passar" a versão anterior; tirar `material.classificacao_herdada`
do check da auditoria (a linha que já o usa deixaria o `VALIDATE` do próximo deploy falhar); rodar o bloco sem o código novo de pé para a extração (o
material que ficar `pronto` entre o bloco e o código novo volta a ficar sem seção, e o bloco se roda de novo).

**Depois:** registre no `TODO.md` a janela (de quando a quando) e quantos materiais receberam seção no bloco, só contagens.

## Voltar o código depois da 5.0 (a IA no worker) (rollback)

*Procedimento, não alerta: não há regra em `infra/grafana/alertas/`. Vale para a volta da versão em que o `POST` grava o job `ia.executar` e o
`worker-ia` conclui (reengenharia-continuacao, tarefa 5.0) para a que roda a IA dentro da API. A 5.0 não tem migration: não há nada a reverter no
banco. O que o procedimento prova está em `apps/api/src/ia/fila-de-ia.int.test.ts` (o caso "a volta do código depois da 5.0"), que roda o bloco de SQL
desta seção.*

**Deploy e volta fora do horário letivo** (regra 80, item 9): a execução `rodando` na hora da volta é encerrada, e quem estava com o Tutor ou uma ferramenta
aberta vê "tentar de novo".

**O que o código anterior faz com o que a 5.0 deixou:**

- **O job `ia.executar`** (`aguardando`, `reservado`, `publicado`, `ativo`): o despachante anterior não conhece o tipo e o publica como tipo desconhecido, na fila do
  worker, sem o prefixo `api-` (`apps/despachante/src/job-publisher.test.ts`: "o tipo da API vai à Queue da API da fila dele, o do worker e o tipo desconhecido, à do
  worker"). Nas filas `interativa` e `normal`, o `worker-interativo` anterior o falha na hora com `TIPO_DESCONHECIDO`, definitivo e sem retentativa
  (`packages/core/src/jobs/job-executor.ts`), e a execução continua `pendente`. Na `ferramenta`, nenhum worker anterior a consome: o job fica parado na fila, como o job
  sintético do alerta "ferramenta esperando". Nenhum dos dois trava o despachante, e por isso o bloco abaixo só os conclui, para não sobrar job de uma execução que o
  código anterior já encerrou.
- **A execução `pendente` e a `rodando`**: a API anterior, ao subir, roda a varredura da subida (`falharInterrompidas`) e as encerra com `EXECUCAO_INTERROMPIDA`. O
  bloco faz o mesmo antes, para o resultado não depender da hora em que a API sobe, e o aluno ou a professora vê "tentar de novo" em vez de esperar.
- **O `worker-ia-1` e o `worker-ia-2`**: o compose anterior não os tem. Sem `--remove-orphans` eles continuariam de pé, com o código novo, consumindo as filas
  `api-interativa`, `api-ferramenta` e `api-normal` (e rodando, no banco que o código anterior usa, qualquer job velho). Por isso se param **antes**.
- **O que a execução produziu e já gravou** (versão adaptada, entrega `pendente`, mensagem do Tutor, consumo): fica, porque o código anterior lê as mesmas
  tabelas. A entrega `pendente` continua esperando a decisão da professora.

**Antes de voltar:**

1. `docker compose stop worker-ia-1 worker-ia-2`: a graça é de 20 s, e o que roda é abortado e fica `rodando`.
2. Pare a API (nada novo grava execução durante o passo).
3. Rode o bloco, numa transação, na entrada do `psql`: `docker compose exec -T postgres psql -U educa -1 -v ON_ERROR_STOP=1`.
4. Suba o código anterior **com** `--remove-orphans`, para o compose não deixar os `worker-ia-*` de pé.

```sql
-- volta-da-5.0: bloco, antes de subir o código anterior
update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now()
 where estado in ('pendente', 'rodando');
update job_registro set estado = 'concluido', concluido_em = now()
 where tipo = 'ia.executar' and estado in ('aguardando', 'reservado', 'publicado', 'ativo');
```

Confira depois, só com contagens: `select count(*) from execucao_agente where estado in ('pendente', 'rodando')` e
`select count(*) from job_registro where tipo = 'ia.executar' and estado not in ('concluido', 'falhou')` devem dar 0, e `docker compose ps` não pode listar `worker-ia-*`.

**Na volta para a versão nova (roll-forward):** não há bloco a rodar. As execuções do período já estão `falhou` e os jobs, `concluido`; um job velho que ainda esteja nas filas `api-*` do
Redis cai numa execução já encerrada, a transição `pendente → rodando` não acontece, e o modelo não é chamado.

**Não faça:** rodar o bloco com o `worker-ia` de pé (ele pegaria a execução no meio do passo); apagar à mão as chaves `api-*` do Redis; reabrir uma execução `falhou` pelo bloco para
"retomar" a resposta (a retomada é da tarefa 6.0, e o aluno tenta de novo pela tela).

**Depois:** registre no `TODO.md` a janela (de quando a quando) e quantas execuções e quantos jobs o bloco fechou, só contagens.

## A D62 na subida: o `worker-ia` parado (procedimento)

*Procedimento, não alerta: não há regra própria em `infra/grafana/alertas/`; o sinal é o healthcheck do `worker-ia` (o batimento não bate) e, com a fila esperando, o alerta "Job
interativo esperando" (causa 5). Vale só com `IA_ADAPTADOR=openai_compat` e `LLM_PROCESSAMENTO_LOCAL=false`: o adaptador falso e o modelo local não enviam nada para fora, não têm
suboperador a conferir e sobem sem ele (reengenharia-continuacao, tarefa 8.0; D62; decisão de 16/11).*

**O que o código faz.** Na subida, cada `worker-ia` lê o suboperador **vigente** (`fim` vazio) cuja `chave` é a `IA_PROVEDOR_ID` e exige: `pais = 'BR'`, treinamento vedado,
`alcance = 'todas'` e, em `categorias`, a união das que as tarefas de IA enviam (hoje `conversa_do_aluno`, `conversa_do_professor`, `material_da_escola` e `trabalho_do_aluno`; a fonte é o
`categoriasEnviadas` de cada tarefa em `packages/core/src/ia/tasks/`). Sem isso, o `worker-ia` **falha fechado**: não cria o consumidor das filas `api-*` nem bate o batimento, e o gateway recusa a tarefa
com texto de aluno (`IA_INDISPONIVEL`, log `ia.geracao.soberania_recusada`). O que não leva texto de aluno e a resposta fixa do assunto delicado (D36, o 188) não passam por essa recusa.
Com o banco fora, a conferência também não passa. **A API não confere e não muda:** a `/prontidao` dela responde como sempre, e login, prova e o resto do produto seguem de pé (o horário de aula
é sagrado, regra 80). Quem pergunta ao Tutor durante a falha vê "Tentar de novo" depois do corte da espera de 20 s (AIA do Tutor, itens 15 e 16), e **o professor vê o contador**: no uso da turma
(`?ver=tutor`), cada aluno que perguntou mostra "N perguntas que o Tutor não respondeu hoje", sem o texto. Numa manhã com o `worker-ia` parado, é por ali que a professora percebe o que a turma está passando; é uma razão a
mais para avisar a coordenação das escolas (seção "Como avisar as escolas").

**Primeiro olhar.** O log do `worker-ia` (`docker compose logs --since 10m worker-ia-1 worker-ia-2`): `ia.soberania_na_subida_recusada` traz `provedorId` e o `codigo`, com os motivos separados por vírgula
(`sem_suboperador_vigente`, `pais_fora_do_brasil`, `treinamento_nao_vedado`, `alcance_nao_e_todas`, `categoria_faltando:<categoria>`); `ia.soberania_na_subida_sem_banco` é o banco que não respondeu.
A instância confere de novo a cada 5 s (`INTERVALO_DA_NOVA_CONFERENCIA_MS`), e o mesmo motivo repetido sai de novo só a cada 12 tentativas seguidas dele (`REPETICAO_DO_LOG`, cerca de um minuto);
o motivo que muda sai na hora.

**Causas prováveis:**

1. `sem_suboperador_vigente` → o provedor da `IA_PROVEDOR_ID` não está cadastrado, foi encerrado (`ops:suboperador encerrar`) ou a chave da variável não é a do cadastro: cadastre-o
   (`ops:suboperador`, o cadastro da operação) ou corrija a variável.
2. `pais_fora_do_brasil`, `treinamento_nao_vedado`, `alcance_nao_e_todas` → o contrato do provedor não cobre a D62: **não afrouxe o cadastro para subir**, e **nunca troque só
   `LLM_PROCESSAMENTO_LOCAL=true` com o provedor externo no `LLM_BASE_URL`**: isso declara local o que sai para fora (regra 20, item 13). Só o modelo local de verdade (o `LLM_BASE_URL` e o
   `LLM_MODELO` dele, com a flag junto) dispensa o suboperador; até haver contrato que cubra, o Tutor e as ferramentas ficam sem responder, e a coordenação é avisada (seção "Como avisar as escolas").
3. `categoria_faltando:<categoria>` → uma tarefa passou a enviar uma categoria que o suboperador não lista: o contrato precisa cobri-la antes do cadastro; só então o operador a acrescenta.
4. `ia.soberania_na_subida_sem_banco` → o Postgres está fora ou lento: veja o alerta do banco. A instância se confere sozinha quando ele volta.

**Corrigido o cadastro, o `worker-ia` se confere sozinho** na tentativa seguinte (até 5 s) e passa a consumir, sem reiniciar.

**Encerrar um suboperador pede reiniciar os `worker-ia`, a qualquer hora.** Depois de conferida, a instância não lê o cadastro de novo: o suboperador encerrado (`ops:suboperador encerrar`)
continua valendo para ela até ela reiniciar. Ao encerrar, reinicie o `worker-ia-1` e logo depois o `worker-ia-2` (`docker compose restart worker-ia-1`, depois o 2): eles não carregam login nem prova, e,
sem a D62 conferida, não voltam a consumir. **A API não reinicia.** Sem o reinício, a IA seguiria enviando ao provedor encerrado.

**Se nada disso resolver:** o Tutor e as ferramentas seguem sem responder enquanto a D62 não é conferida, e isso é o desenho: avise a coordenação das escolas e não contorne a conferência.

**Depois:** registre no `TODO.md` o motivo e por quanto tempo o `worker-ia` ficou parado.

## Rotina do sistema sem rodar (consolidação de uso, expurgo de jobs, expurgo do acesso)

*A preencher antes da primeira escola real* (pendência em `TODO.md`). Hoje nada avisa se
`sistema.consolidar-uso` (2h), `sistema.expurgar-jobs` (3h30) ou `sistema.expurgar-acesso` (4h30) param de
rodar (o `sistema.expurgar-dado-pessoal`, à 1h, tem alerta próprio: "Expurgo incompleto por duas noites numa escola"): o uso por escola deixa de ser consolidado, `job_registro` cresce sem expurgo, e registro de acesso
com mais de 6 meses, sessão e convite vencidos há mais de 30 dias ficam no banco além da retenção de
`docs/lgpd.md`, o que é descumprimento da LGPD, e não só espaço. Primeira suspeita: o worker-lote ou a
fila `agendamentos`. A última execução de cada uma aparece em `job_registro` (tipo e estado) e no log
(`job_registro.expurgado`, `acesso.expurgado`, só com as contagens). Rodar de novo à mão é seguro: as
três toleram reexecução (D49), e o expurgo do acesso não apaga nada dentro do prazo. O mesmo job apaga também o
acesso da turma (link e código da sala, 30 dias depois de vencer ou ser revogado, A1), o acesso à operação (6 meses),
a sessão e o convite de operador (30 dias): parado, eles também passam da retenção.
A auditoria da operação e a conta do operador nunca passam por ele.

**Escola pulada na consolidação de uso** (painel "Uso por escola pulado na consolidação", métrica
`uso_escola_ignorada_total` por `origem` e `causa`; log `uso.escola_ignorada`, com o id da escola, a origem, a causa e o
erro resumido: SQLSTATE e restrição, ou o tipo). Sem alerta. A consolidação pula a escola que o banco recusa e segue com as
outras. Por causa:
1. `escola_inexistente`: a escola não está mais no banco. O SeaweedFS guarda a pasta `escolas/<id>/` vazia depois que os
   objetos saem, e por isso ela volta toda noite, com `origem="storage"`. É esperado depois de uma eliminação. O contador do
   Redis (`origem="contador"`) não é apagado: ele vence sozinho em 35 dias. Se o id for de uma escola que devia existir,
   pare: é o worker apontado para outro banco, ou uma restauração pela metade. Confira o `BANCO_URL` do worker-lote antes
   de qualquer outra coisa. Nada foi perdido, porque o contador continua no Redis até vencer.
   **Todas as escolas da noite inexistentes:** quando nenhuma escola encontrada (no contador e no storage) existe no banco,
   a consolidação pula cada uma como acima, mas o job falha no fim, com `uso.nenhuma_escola_no_banco` no log (só a
   contagem, `encontradasTotal`), e aparece como job falho em `job_registro`; a fila tenta de novo e falha igual. Sem
   alerta: até existir o de rotina parada (pendência "alerta para rotina do sistema que parou de rodar", `TODO.md`), só
   quem procura em `job_registro` ou no log vê. Primeiro, o caso do `BANCO_URL` acima: o primeiro passo é o mesmo.
   Corrigido o banco, rode a consolidação de novo à mão (D49); os contadores ainda estão no Redis. Se o banco está certo e
   todos os ids da noite são de escolas eliminadas (uma noite sem requisição de escola nenhuma, com a pasta vazia de uma
   eliminada no storage, basta), é o resto de uso que a eliminação ainda não apaga (pendência "Eliminar escola apaga
   também o resto de uso dela", `TODO.md`): apague a pasta `escolas/<id>/` vazia no storage.
2. `valor_invalido`: um contador com texto, ou com um dia que não existe na chave. Nada no sistema escreve assim: é chave
   gravada à mão ou corrompida. Veja com `redis-cli --scan --pattern 'uso:*:<id>:*'` no Redis de fila e apague a chave errada.
   O contador válido da mesma escola, em outro dia, foi gravado normalmente.
3. `erro_de_storage`: a listagem da pasta da escola falhou. As outras escolas foram medidas, e o job falha no fim para a
   fila tentar de novo, então também aparece como job falho em `job_registro`. Depois de três pastas seguidas com erro, a
   rotina desiste na hora, porque é o storage fora: siga pelo storage (`docker compose ps storage`). Rodar de novo à mão é
   seguro (D49).

## Operador não entra no painel da operação (Redis de fila fora)

Sem alerta próprio: aparece como o 503 `INDISPONIVEL_TENTE_DE_NOVO` ao concluir o segundo fator
(`POST /v1/operacao/sessao/mfa` e `/sessao/mfa/configurar`) e como `operacao.desafio_sem_redis` no log da API, no
máximo uma linha a cada 30 s e sem nada da pessoa. A marca de desafio usado mora no Redis de fila; sem ela não dá para
saber se o desafio já foi usado, e o painel recusa em vez de aceitar. Do lado das escolas, o mesmo Redis fora é o
"Seguro de limite ativo", causa 4. A sessão de operador já aberta não usa a marca de desafio e segue até vencer.
**O que fazer:** o Redis de fila é o mesmo da fila de jobs; siga "Seguro de limite ativo", causa 4
(`docker compose ps redis-fila`; parado, `docker compose up -d redis-fila`). **Enquanto ele não volta, o caminho da
equipe são os comandos `ops:*`**, que falam direto com o banco e não passam pelo desafio: `ops:escola`,
`ops:convite-coordenador`, `ops:revogar-convite`, `ops:redefinir-mfa`, `ops:uso` e `ops:operador` (README, "Rodando local"). Não há o que liberar à mão: com o Redis de volta, o
operador entra de novo com e-mail e senha.

## Sistema fora do ar no horário letivo

*A preencher quando o staging existir (D31).*

## Tutor lento (p95 do primeiro token acima do limite)

*A preencher no F5.* Primeira suspeita: tokens por minuto perto do limite do provedor.

## Provedor de IA fora

**Dispara quando:** o disjuntor de um modelo e perfil do gateway de IA está aberto (ou meio aberto) por 2 min seguidos (`max by (provedor, modelo, perfil) (ia_disjuntor_aberto)` acima de zero, por 2 min;
regra `infra/grafana/alertas/ia-provedor-fora.yaml`; reengenharia-continuacao, tarefa 10.0). O disjuntor abre com cinco falhas seguidas do provedor (5xx, conexão recusada ou prazo estourado; o 429 e o outro 4xx não contam: o
provedor está de pé, só recusou), é em memória por réplica do `worker-ia` (a regra toma o maior valor entre as réplicas) e meio abre a cada 30 s para uma chamada de teste. Resolve sozinho quando o disjuntor fecha. A série não leva escola, execução nem usuário.

**Impacto:** toda chamada ao modelo daquele perfil termina `IA_INDISPONIVEL` na hora, sem esperar o prazo: o Tutor (`rapido`) mostra "Tentar de novo" ao aluno (nunca o erro do provedor), e a ferramenta, o Assistente e o Analista
(`padrao`) mostram o mesmo à professora ou à coordenação. A regra fixa do assunto delicado (D36) não depende do provedor: o aluno continua recebendo o 188. O disjuntor é por modelo: o modelo menor tem o seu, e o degrau do gateway só o usa por falta de vaga de tokens, e não por provedor fora.

**Primeiro olhar:** o painel "IA: chamadas ao provedor" (duração e erros por `provedor`, `perfil` e `codigo`, de `ia_chamada_duracao_seconds` e `ia_chamada_erros_total`) diz se o código é `IA_INDISPONIVEL` (o provedor caiu ou recusou conexão) ou
`IA_TEMPO_ESGOTADO` (ficou lento). O log do `worker-ia` traz `ia.geracao.falhou` com `tipo` (a tarefa), `codigo`, `escolaId`, `execucaoId` e `duracaoMs`, nunca a entrada nem o prompt (veja "Buscar um erro no log pelo `tipo`").
Do próprio servidor, sem dado de aluno: `curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' "$LLM_BASE_URL/models"` a partir do container do `worker-ia` (`docker compose exec worker-ia ...`), que diz se o provedor responde dali.

**Causas prováveis:**
1. O provedor está com incidente ou fora do ar (o status dele, e a chamada acima falha ou demora) → não há o que consertar do nosso lado: o disjuntor volta sozinho quando a chamada de teste de 30 s der certo. Avise as escolas que usam o Tutor no horário (veja "Como avisar as escolas").
2. A chave ou a URL mudou ou venceu (`LLM_BASE_URL`, `LLM_CHAVE_API`: a chamada acima devolve 401 ou 404, que não abre o disjuntor; se abriu, o provedor devolveu 5xx para a chave) → corrija a variável do `worker-ia` e recrie só ele (`docker compose up -d worker-ia`), fora do horário letivo se der.
3. A rede do servidor para o provedor caiu (conexão recusada, DNS) → `docker compose exec worker-ia getent hosts <host do LLM_BASE_URL>`; a causa é da VPS ou do provedor de rede, e não do código.
4. O prazo do perfil ficou curto para um modelo que ficou lento (`IA_TEMPO_ESGOTADO` no painel, com o provedor respondendo) → é capacidade do provedor ou do modelo: veja "Tokens acima de 80% do contratado" (a espera por vaga come o prazo) antes de mexer em `LLM_TIMEOUT_MS` (complexo e visão), `LLM_TIMEOUT_MS_RAPIDO` ou `LLM_TIMEOUT_MS_PADRAO`.

**Se nada disso resolver:** não há provedor de reserva até a D37 (a degradação declarada é a espera e o modelo menor do mesmo provedor, que não ajuda com o provedor fora). Avise a coordenação das escolas em sala de que o Tutor e as ferramentas estão fora, dizendo o que continua
funcionando (matérias, notas e turmas não dependem da IA), e suspenda a função da escola pelo painel de governança se a escola preferir o aviso na tela a "Tentar de novo". Não troque o provedor por conta própria: a D62 exige o suboperador cadastrado, e uma troca às pressas sem o cadastro é o que a subida recusa.

**Depois:** registre no `TODO.md` a hora, o provedor, o código dominante e quanto tempo durou (sem id de escola: o repositório é público). Mais de uma vez por mês, o contrato e a reserva da D29 e da D37 viram tarefa.

## Tokens acima de 70% do contratado

**Dispara quando:** o modelo já consome 70 % ou mais do contratado de tokens por minuto, por 5 min seguidos (`max by (modelo) (ia_tokens_uso_do_teto) >= 0.7`, por 5 min; regra `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`; reengenharia-continuacao, tarefa 10.0).
É o **aviso**: o balde geral tem 80 % do contratado (`LLM_TOKENS_POR_MINUTO`), e este alerta sobe com 12,5 % de folga ainda. No pico da manhã de segunda esperam-se uns 68 %, e por isso são 5 min seguidos, e não o pico de um minuto.

**Impacto:** nenhum ainda. Quem pede ao modelo é atendido na hora; a espera pela vaga e o modelo menor só começam com o balde cheio.

**Primeiro olhar:** o painel "IA: uso do teto de tokens, por modelo" (`ia_tokens_uso_do_teto`) e o consumo do dia por função (`ops:uso`, sem dado de aluno): se é o Tutor de várias turmas ao mesmo tempo (normal às 10h), a ferramenta de uma escola, ou o Analista.

**Causas prováveis:**
1. A manhã de segunda, com muitas turmas no Tutor ao mesmo tempo → é o esperado perto do limite do desenho (`docs/infra.md`, "Tokens por minuto"): acompanhe se passa para o alerta de 80 %; se for toda semana, o contratado sobe.
2. Uma escola nova entrou e o contratado não acompanhou → some os alunos ativos ao desenho de `docs/infra.md` e peça ao provedor mais tokens por minuto antes do próximo horário de pico.
3. Um laço de execuções (uma ferramenta chamada em repetição, uma tarefa que repete a saída inválida) → `ops:uso` mostra a função e a escola; a escola vê o teto do orçamento dela antes de o provedor ver o teto global.

**Se nada disso resolver:** suba o contratado com o provedor, ou ajuste `LLM_TOKENS_POR_MINUTO` (o teto do balde) para o que o contrato dá de fato, e recrie o `worker-ia` e a API (`docker compose up -d worker-ia api`), fora do horário letivo. `LLM_TOKENS_POR_MINUTO` **acima** do contratado desliga a folga: nunca o suba sem o contrato mudar.

**Depois:** registre no `TODO.md` a hora, o modelo e o pico (a fração) observado. Aviso que se repete toda semana vira tarefa de capacidade.

## Tokens acima de 80% do contratado

**Dispara quando:** o balde geral do modelo está cheio por 5 min seguidos (`max by (modelo) (ia_tokens_uso_do_teto) >= 0.8`, por 5 min; o `0,8` é o `PARTE_DO_BALDE_GERAL` do `TokenLimiter`, que o teste de alertas confere; regra
`infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`; reengenharia-continuacao, tarefa 10.0). **É saturação de capacidade, e não defeito do código, mas isso não é "nada a fazer":** o gateway está fazendo o que a regra 80, item 4, pede (o limite abaixo do contratado, com a espera e o menor), e o alerta diz que isso virou rotina, com aluno vendo "Tentar de novo" em sala agora. Quem está de plantão olha o impacto abaixo e a ação em "Se nada disso resolver".

**Impacto:** a chamada sem vaga espera até 8 s ("Pensando" para o aluno, no prazo único da execução: 60 s no Tutor, 140 s na ferramenta); passados os 8 s vai ao modelo menor do perfil, se houver e se a tarefa puder (**o turno do Tutor nunca**), e termina `IA_INDISPONIVEL` se também lá não
houver vaga: "Tentar de novo" na tela, nunca erro cru. A `ferramenta` (teto de 15 %) e a `normal` (10 %) esperam antes do Tutor, que só olha o balde geral. Cada degrau tem a sua métrica (`ia_degradacao_total{degrau}`: `espera`, `modelo_menor`, `indisponivel`).

**O balde é um só para todas as escolas, de propósito** (`docs/infra.md`, "Tokens por minuto"): uma escola com muita carga pode esgotá-lo e fazer o Tutor de outra terminar `IA_INDISPONIVEL` depois de 8 s. Não vaza dado, mas é interferência entre escolas, e as vagas por escola (RF2) não a impedem, porque são outra barreira. Avaliar uma parte por escola está no `TODO.md`, para quando o piloto tiver mais de uma escola com carga real.

**O painel superestima, e é seguro:** a reserva é a estimativa da chamada, e o uso real só a acerta quando a resposta chega. Chamada que falha não chama o `acertar`, e a estimativa fica no balde até o fim do minuto; as repetições internas do `ResilientAdapter` (o recuo e a nova tentativa do mesmo pedido) gastam tokens sem reserva nova. Por isso, com o provedor instável, o uso do teto pode passar do que o provedor de fato cobrou.

**Primeiro olhar:** os painéis "IA: uso do teto de tokens, por modelo" e "IA: degraus da degradação" dizem quanto do minuto está ocupado e em que degrau os pedidos estão caindo; o aumento de `ia_degradacao_total{degrau="indisponivel"}` é o que o aluno e a professora já sentem. Com o `ia_espera_estourada_total` junto
(alertas "Pergunta do Tutor cortada na espera"), a saturação é da fila e do provedor, e não de uma escola.

**Causas prováveis:**
1. O pico da manhã de segunda ou uma prova com Tutor liberado em várias escolas → capacidade: peça ao provedor mais tokens por minuto e suba `LLM_TOKENS_POR_MINUTO` junto, por escrito no contrato (`docs/infra.md`, "Tokens por minuto").
2. Um laço (uma tarefa que repete a saída inválida, uma escola que dispara ferramenta sem parar) → `ops:uso` mostra a função e a escola; o orçamento da escola corta o laço dela. Uma tarefa que repete a saída inválida é defeito de prompt, e vira tarefa com teste.
3. Um segundo `worker-ia` subiu sem entrar na conta (`IA_REPLICAS` não foi atualizada) → com o Redis de pé o balde é um só entre as réplicas e isso não muda o teto; mas, com o Redis fora, cada réplica segura o teto ÷ `IA_REPLICAS`, e o número errado dá teto a mais ou a menos: confira `IA_REPLICAS` no compose.

**Se nada disso resolver:** avise a coordenação das escolas com Tutor em sala de que a IA está lenta nesse horário e que "Tentar de novo" é esperado; não suba `LLM_TOKENS_POR_MINUTO` acima do contratado "para passar": é o que a folga de 20 % protege contra o 429 do provedor. Se o modelo menor está respondendo, as ferramentas seguem; o Tutor não tem menor (D36).

**Depois:** registre no `TODO.md` a hora, o modelo, quantos minutos e o degrau mais alto (só contagens, sem id de escola). Saturação que se repete vira tarefa de capacidade e entra na planilha de custo (`docs/infra.md`).

## Salvamento de resposta de prova lento ou falhando

*A preencher no F6.* Prioridade máxima: há aluno fazendo prova agora.

## Backup do dia não concluído

*A preencher antes da primeira escola real.*

---

## Ensaiar os alertas

`npm run ensaio:alertas`, com o ambiente local de pé (`docker compose up`), provoca as três
condições do F0 de uma vez, e as duas do login: para o `worker-interativo` e manda um job interativo, para o Redis de cache,
e força 5xx em `POST /v1/sistema/jobs-sinteticos` para uma escola sintética (um gatilho
temporário no banco recusa a gravação só dessa escola). Confere pela API do Grafana que as três
regras chegam a disparadas, e restaura tudo: religa o que parou, remove o gatilho e espera as três
voltarem a normal. Leva uns 8 minutos, por causa dos 5 min da regra de 5xx. Só roda com
`AMBIENTE=local`, e um de cada vez: o gatilho tem nome fixo, e um segundo ensaio no mesmo banco
remove o gatilho do primeiro. Com o ambiente parado, o ensaio o sobe inteiro e o deixa de pé.

O ensaio provoca também os quatro alertas de login: recria as APIs com um hash por vez e o argon2 muito mais caro
(`LOGIN_HASH_CONCORRENCIA=1` e `LOGIN_ARGON2_ITERACOES` alto, só no contêiner do ensaio), manda logins de matrícula que
não existem ao endereço de uma escola sintética até o semáforo passar do prazo, e em paralelo logins por e-mail sem
conta acima do limite por IP. Confere que "Login lento" e "Login recusado pelo semáforo do hash" disparam depois dos
3 min de cada um, "Login rebaixado numa escola" (as falhas do IP do ensaio passam do limiar daquela escola) depois dos
2 min, e "Login por e-mail acima do limite por IP" depois dos 5 min. Nenhum login do ensaio recebe 429. No fim, espera as regras voltarem a normal e só então recria as APIs
com o `.env` de sempre (a instância que sai deixa o último valor no Prometheus por até 5 min). Se o ensaio for
interrompido, recrie-as à mão: `docker compose up -d --force-recreate --no-deps api-1 api-2`.

O ensaio provoca também o "Código da turma errado em massa numa escola": numa escola sintética sem acesso nenhum, doze
laços tentam códigos da turma no formato, um por segundo cada, pela página da sala. Em uns 90 s a escola passa do teto de
1.000 códigos errados, as tentativas seguintes esperam 1 s e somam na métrica, e a regra dispara 5 min depois. Nenhuma
tentativa recebe 429 nem 5xx: todas `NAO_ENCONTRADO`. A escola do ensaio fica acima do teto só até a janela de 10 min dela
virar, e nenhuma escola real sente.

O ensaio provoca também o "Extração de PDF parada": para o `worker-pdf` (a linha de comando sobe a stack inteira, e ele tomaria o job) e grava um job `material.extrair-pdf` na fila `pdf` com o `criado_em` há 16 min
(uma escola sintética, sem material: o job nunca roda) e espera a regra disparar 1 min depois de o despachante medir a espera. Na restauração o job sai da tabela e o `worker-pdf` volta. A extração terminada que o
segundo termo procura não existe no ensaio, e o dispara prova os dois termos juntos; o "não dispara" de cada termo tem prova própria em `infra/test/alerta-do-pdf-parado.int.test.ts`.

O "Reuso de refresh" não entra no ensaio, porque não nasce de serviço parado: ele tem prova própria em
`infra/test/alertas.int.test.ts`, que reusa cinco cookies (a regra fica normal) e depois o sexto (dispara), na
esteira.

## Rodar o cenário de carga

`npm run carga` roda o cenário "justiça entre escolas" num projeto compose próprio (`educa-carga`),
que não toca no ambiente de desenvolvimento nem no de teste, e o derruba no fim. Passa quando a
espera da escola B com a escola A enchendo a fila fica até 500 ms acima da espera sem ela, quando só o
usuário abusivo recebe 429 e quando `job_registro` mostra nenhum job `falhou` e nenhum interativo
acima de 30 s. Rode de novo quando uma tarefa mexer no caminho quente (fila, despachante, worker,
rate limit, borda) e registre o resultado na tarefa.

Se reprovar, a saída diz o critério. Espera da B acima da margem ou interativo acima de 30 s é o
problema de justiça entre escolas: olhe a vaga por escola e o rodízio do despachante antes de
qualquer outra coisa, e confirme com `npm run carga:controle-negativo`, que precisa continuar
reprovando (sem a vaga por escola, o cenário tem de quebrar). 429 fora do usuário abusivo é o rate
limit tratando escola como IP. `k6_base` ou `k6_carga` é o ambiente que não rodou até o fim: veja os
logs que o script imprime.

**A fase do expurgo e da troca de nome (F3, tarefa 19.0).** Entre a base e a carga, o cenário semeia a escola A com 1 milhão de
linhas vencidas (250 mil execuções do Tutor, as 500 mil mensagens delas e 250 mil consumos com texto), o ano de uso de um titular
e o pedido de eliminação dele, agendado e vencido; grava o `retencao.expurgar-escola` da A, como a rotina da noite o grava, dez
segundos depois de o k6 começar a carga da B; e o worker de lote expurga e troca o nome **de verdade**. O Postgres do cenário
carrega o `pg_stat_statements` (`infra/compose.carga.yml`), e a saída imprime os cinco statements mais lentos. Ao lado do job
sintético, a escola B exerce o **turno do Tutor pela rota** (`POST /v1/tutor/mensagens`, lido em `GET /v1/execucoes/:id`),
com 30 alunos sintéticos, 1,5 turno por segundo e o adaptador falso com `IA_LATENCIA_FALSA_MS=300` (`infra/carga.env`). O
`turno_b` do k6 mede do POST à execução concluída (a API não devolve datas), e o critério da fase usa `criada_em` a
`concluida_em` do banco, só dos turnos criados durante o trabalho da A. Reprova (critério, e o que olhar):

- `statement_acima_de_2s`: um statement da fase chegou a 1,5 s (`TETO_DA_MEDIDA_MS`, abaixo do `statement_timeout` de 2 s) no
  `max_exec_time`, **ou** o log do Postgres da fase tem statement cancelado pelo `statement_timeout`. O cancelado não entra no
  `max_exec_time` e o executor repete o job, por isso o log é lido (`canceling statement due to statement timeout`). Olhe o
  lote do alvo que a saída mostra (`LOTE_DO_EXPURGO`, `LOTE_MAXIMO_DO_ALVO` e a faixa de 1.000 linhas da troca de nome) e o
  `EXPLAIN` do índice dele;
- `turno_b_no_expurgo`: o p95 do turno do Tutor da B **durante o trabalho da A** passou do p95 do mesmo turno na base mais
  500 ms. Olhe a escrita do Tutor nas tabelas que o expurgo atualiza em lote (`execucao_agente`, `mensagem_tutor`,
  `consumo_ia`) e o tamanho do lote;
- `espera_b_no_expurgo`: o p95 da espera da B **durante o trabalho da A** passou da base mais 500 ms. É a mesma regra do k6
  aplicada só à janela em que o expurgo rodava, porque ele dura segundos e o p95 dos dois minutos o diluiria;
- `sem_amostra_da_b`: menos de 10 jobs da B, ou menos de 5 turnos do Tutor da B, nasceram durante o trabalho da A, e a
  medida não diz nada. O mínimo do turno é menor porque a escola tem teto de 120 pedidos de IA por minuto e o trabalho dura uns
  10 s. Suba `VOLUME_DA_A` (`infra/scripts/expurgo-da-carga.ts`) ou veja se o job do expurgo demorou a começar;
- `expurgo_incompleto` e `troca_de_nome_incompleta`: sobrou linha vencida, o pedido não concluiu, alguma das 12 categorias não
  terminou, o nome ainda aparece ou o titular ainda existe: o job de uma das duas rotinas falhou ou parou na janela letiva (a
  escola A fica sem dia letivo na fase, de propósito);
- `job_da_a`: um job da A falhou, não terminou em 15 min, ou o expurgo não enfileirou a eliminação;
- `statements_sem_amostra`: o `pg_stat_statements` não respondeu, não viu uma das tabelas do expurgo, ou o log do Postgres da
  fase não foi lido. A saída diz por que a medição ficou indisponível (`medição de statements indisponível: …`).

A fase não roda no controle negativo (`npm run carga:controle-negativo`): ela não depende da vaga por escola. Mede também, só
para informar, quanto os índices parciais da anonimização (`execucao_agente` e `consumo_ia`) custam a mais por linha de Tutor
inserida (`TODO.md`, "Escrita a mais por troca do Tutor").

## Rodar o cenário de login

`npm run carga:login` roda o cenário "login às 7h30" (tarefa 16.0) no mesmo projeto compose próprio (`educa-carga`) do
cenário de carga, e o derruba no fim. Leva uns 20 min. Não rode junto com o portão, com os testes nem com o outro
cenário: os dois sobem o mesmo projeto, e a medição depende da CPU livre. As fases, em ordem: base (B e C sem ataque),
rajada (2.100 contas em 5 min, 40% no primeiro minuto, 30% errando a senha uma vez), renovação em duas abas, ataque de
fora (um segundo container k6), ataque de dentro (do IP da escola) e o Redis de fila derrubado no meio de um ataque.

Passa quando o p95 do login fica abaixo de 1 s na rajada, e na B, na C e nas contas com cookie da A e da equipe durante os ataques, as autenticadas da B e da C
ficam até 250 ms acima da base, nenhuma conta legítima com o cookie de dispositivo recebe 429, nenhuma conta legítima
termina em erro (a web repete o 503 por até 30 s), nenhuma família de sessão é encerrada por reuso, o rebaixamento
aparece só na A e só durante os ataques, e `limite.seguro_ativo` chega a 1 com o Redis de fila fora. Rode de novo quando
uma tarefa mexer no login, no semáforo, no rebaixamento, na renovação ou no hash, e registre o resultado na tarefa.

Para depurar uma fase sem esperar o cenário inteiro: `npm run carga:login -- --fases rajada` (a base roda sempre). O
resultado parcial não vale como registro.

**Resultado de referência (06/11/2026, 15 min, passou):** prévia e gravar com 3.000 linhas, p95 de 319 ms e 196 ms (máximo da prévia 1,7 s,
no primeiro encontro com a rajada), com a rajada de login em p95 107 ms e zero 5xx; transferências: passo (3) 12 vezes, todas até 1 s
(a maior, entre 0,25 e 0,5 s), e a espera de trava **+4 ms** no gerar acesso e **+6 ms** na decisão, zero 503; desligamentos e virada:
passo (3) 5 vezes, todas até 0,75 s (100 desligamentos, 3 × 100 e a virada de 900); professores: 11 jobs e 181 logins, zero 503, passo (3)
sempre até 0,25 s. Sem teto, a primeira medição dos desligamentos foi 100 abaixo de 0,75 s, 200 entre 1 e 1,5 s e 300 entre 1,5 e 3 s.

**Cuidado ao mexer no driver:** o token de acesso da coordenação vale 10 min (`VALIDADE_TOKEN_ACESSO_SEGUNDOS`) e é emitido quando a escola
da fase é criada. O que demora (semear as 2.100 contas da rajada, que leva minutos) vem **antes** de criar a escola, e nunca depois: na
primeira tentativa a ordem era a inversa, e três prévias do fim da fase voltaram 401.

Se reprovar, a saída diz a fase e o critério:
- **p95 do login na rajada acima de 1 s, ou conta que não entrou:** o hash custa mais do que a CPU de referência aguenta.
  Confira `LOGIN_ARGON2_ITERACOES` em `infra/carga.env` contra a calibração da Tech Spec da identidade (seção 5, "Hash").
  Não baixe abaixo do mínimo da OWASP (a API não sobe); a saída é mais CPU por instância, não hash mais fraco. **Antes de mexer na infra, confira se foi o host:** meça o hash e leia o
  throttling como diz "Quando a carga vale como registro" (abaixo). Com o hash acima de ~35 ms a rodada não vale, e se repete com a máquina calma.
- **B ou C degradadas num ataque:** o rodízio entre baldes do semáforo não está separando as escolas. Confirme com
  `npm run carga:login:controle-negativo`, que precisa continuar reprovando (sem os baldes e o rebaixamento, o cenário
  tem de quebrar).
- **429 para conta com cookie:** o contador `conhecido`/`outro` (4.0) não está separando o dono do script.
- **família encerrada por reuso:** a janela de 2 s do `JA_RENOVADO` (5.0) não está cobrindo as duas abas.
- **`k6` da fase:** o ambiente não rodou até o fim; veja os logs que o script imprime.

## Rodar o cenário da sala

`npm run carga:sala` roda o cenário "reivindicação em sala" (A1, tarefa 9.0; K1 e K2 da Tech Spec da A1) no mesmo projeto
compose próprio (`educa-carga`) dos outros cenários, e o derruba no fim. Leva uns 15 min, mais a construção das imagens. Não rode junto com o portão, com
os testes nem com os outros cenários: os três sobem o mesmo projeto, e a medição depende da CPU livre. A cada fase ele monta
pela API uma escola nova, como a coordenação e o professor fariam (turmas, lista de 35 nomes gerados cada, professor
confirmado, acesso), e manda os alunos:

- **k1**: seis turmas de 35 em 5 min, com a outra escola entrando por login, de outro container, ao mesmo tempo;
- **k2**: o primeiro dia da escola inteira, 60 turmas e 2.100 alunos em 5 min, também com a outra escola;
- **k2_redis_lento**: 12 turmas em 2 min, com o Redis de fila pausando os clientes 80 ms a cada 100 ms, para medir o
  `decidir` com o Redis devagar.

Em todas, 20% dos alunos erram o código antes, 10% erram a matrícula antes, e dois por turma mandam o pedido de dois
computadores no mesmo segundo. O professor aprova os pedidos em lotes de até 40, a cada 45 s, e cada aprovado entra logo
depois.

Passa quando não há nenhum 5xx (nem o 503 que a página repete), cada disputa tem um vencedor só, todos os alunos terminam
aprovados uma vez (o banco confere: nenhum nome com dois pedidos, nenhum aluno a mais), o p95 do `decidir` fica abaixo de
2 s, o p95 do login da outra escola abaixo de 1 s, e o K2 não segura nenhum código errado no teto da escola (a manhã do
primeiro dia fica abaixo dele). O aprovado entra um depois do outro, pelo professor que o aprovou: a rajada de uma turma
inteira entrando no mesmo minuto é o cenário "login às 7h30", que continua sendo a prova dela. Rode de novo quando uma
tarefa mexer na página da sala, na decisão dos pedidos, nos
limites da sala ou no semáforo do hash, e registre o resultado na tarefa. Para depurar uma fase:
`npm run carga:sala -- --fases k1`. O resultado parcial não vale como registro.

Se reprovar, a saída diz a fase e o critério:
- **5xx ou 503:** o semáforo do hash passou do prazo com a reivindicação e o login juntos. Confira "503 do semáforo" na
  conferência e a calibração do hash em `infra/carga.env` (seção "Rodar o cenário de login").
- **disputa com dois vencedores, ou nome com dois pedidos:** a restrição de um pendente por nome ou a transação da
  reivindicação (Tech Spec da A1, seção 5, passo 4) deixou passar a corrida. É defeito, não capacidade.
- **`decidir` acima de 2 s:** o lote de 40 transações ficou lento. Com o Redis lento, olhe o zerar dos contadores depois do
  lote (`apps/api/src/sala/decisao/decisao.service.ts`).
- **login da outra escola acima de 1 s:** a sala está tirando a vez do login no semáforo. Confira a espera por balde no
  painel.

## Rodar o cenário da importação

`npm run carga:importacao` roda o cenário "a escola inteira entra de uma vez" (F2, tarefa 16.0 de `onboarding-por-convite`; Tech Spec,
seções 7c e 13; PRD, RF15) no mesmo projeto compose (`educa-carga`) dos outros cenários, e o derruba no fim. Leva uns 25 min, mais a
construção das imagens. Não rode junto com o portão, com os testes nem com os outros cenários (`flock /tmp/educa-carga.lock`): os quatro
sobem o mesmo projeto, e a medição depende da CPU livre. Cada fase monta pela API uma escola nova, como a coordenação e a professora
fariam, e roda `infra/k6/importacao-7h30.js`:

- **previa_e_gravar**: a prévia e o gravar de uma planilha de 3.000 linhas (100 turmas de 30), de duas coordenações da mesma
  escola (as duas vagas da planilha), de um container, enquanto a rajada de login do F1 entra com 2.100 contas, de outro. Passa com o p95
  da prévia e o do gravar abaixo de 2 s (PRD, RF15; o PRD admite 10 s, o teto da Tech Spec é 2 s) e a rajada dentro dos limites dela;
- **transferencias_base** e **transferencias**: as 3.000 linhas já gravadas, 180 pedidos de nome pendentes em 60 turmas de dez
  professoras, e a carga que o passo (3) disputa: cada professora gera o acesso das turmas dela (8 por segundo) e decide os pedidos em
  lotes de cinco. A base roda **sem o job**; a segunda roda **com** um job atrás do outro, cada um com 300 transferências (a mesma
  matrícula e o mesmo nome em outra turma, de ida e de volta). É o critério [C] da seção 13;
- **desligamentos_e_virada**: três escolas, uma depois da outra: 100 desligamentos de alunos aprovados num gravar (a conta é desativada
  um por um), 300 em **três gravares de 100** (o teto por gravar, `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR`; a planilha é enviada de novo e a
  prévia mostra quem ainda falta) e a virada de 900 alunos para o ano planejado (o `vinculo.criado` de cada um). Foi esta fase que
  criou o teto: na primeira medição, sem ele, 100 desligamentos ficaram abaixo de 0,75 s, 200 entre 1 e 1,5 s e 300 entre 1,5 e 3 s;
- **professores**: a planilha de 300 professores (200 que já têm conta e 100 novos a cada volta) contra o login dos 200 que já existem, com a rajada de login do F1 ao lado (com os alunos da senha provisória, que trocam a senha pelo bilhete, e os que só têm a conta da escola, que recebem o 401) e o redefinir da senha de 90 desses professores, um por segundo, cada um com o `link_da_conta` que o script semeou pelo banco (o token só sai por e-mail) e a senha da carga como senha nova. Critério (acesso-e-convites, tarefa 10.0): zero 503 no login, na troca da provisória e no redefinir, todo redefinir em 204, passo (3) abaixo de 1 s.

**A espera de trava não tem métrica própria.** O `lock_timeout` do passo (3) corta em 300 ms, mas quem espera é o gerar acesso e a
decisão, e o que o produto promete é que eles não esperem. O cenário a mede por diferença: o p95 do gerar acesso e o da decisão **com** o
job menos o p95 deles na fase `transferencias_base` (a mesma carga, sem o job). A diferença precisa ficar abaixo de 300 ms
(`LIMITE_DA_ESPERA_DE_TRAVA_MS`). O passo (3) é medido pelo histograma `importacao.passo3.duracao` no Prometheus: o cenário confere que
ele rodou ao menos o número de vezes que a fase pede (o job chegou ao passo (3), e a planilha tem transferências nas turmas onde o gerar
acesso roda) e que nenhuma observação passou do balde de 1 s.

Passa quando: nenhum 5xx (o 503 do semáforo do hash entra) nas rotas do cenário, nenhuma resposta fora do esperado, nenhum job `falhou`
nem parado em `na_fila`, as marcas que a prévia oferece são as que o cenário diz (300 transferências, 100 desligamentos por gravar), o passo
(3) abaixo de 1 s, e a espera de trava abaixo de 300 ms sobre a base. Rode de novo quando uma tarefa mexer no motor da planilha, nas travas
do passo (3), no gerar acesso, na decisão dos pedidos ou no login. Para depurar uma fase: `npm run carga:importacao -- --fases
transferencias` (a base entra junto). O resultado parcial não vale como registro. Se o [C] falhar, a Tech Spec manda a spec de volta à
revisão (seção 13): o remédio é teto nas marcas ou comando em grupo, e só se este cenário o pedir. O teto nas marcas já entrou (100
desligamentos por gravar); o comando em grupo só se uma escola real precisar de mais que isso por gravar.

Se reprovar, a saída diz a fase e o critério:
- **prévia ou gravar acima de 2 s:** a classificação de 3.000 linhas está lenta com a rajada em paralelo. Confira a espera pelo semáforo da
  planilha e os statements do `pg_stat_statements` (a prévia lê a lista inteira da escola).
- **espera de trava acima de 300 ms:** o passo (3) segura as turmas por tempo demais. Confira a ordem das travas (Tech Spec, seção 5) e o
  tamanho da transação do job.
- **passo (3) acima de 1 s:** o laço de `vinculo.criado` um por um (a virada) ou o `desativar` um por um (os desligamentos) é o que cresce
  com a escola. Se foi um desligamento, confira se o teto por gravar (100) ainda vale e se `desativar` ganhou trabalho por pessoa; se foi a
  virada (sem marca, 900 alunos), é ela que precisa do comando em grupo, porque não há marca para limitar.
- **503 no login dos professores:** primeiro confira o hash e a máquina ("Quando a carga vale como registro", abaixo): 503 com o hash a mais de ~35 ms é o host, e a rodada se repete. Com o hash na referência, o job de professores achou ou criou a conta global enquanto eles entravam e tomou a vez do hash.
- **passo (3) rodou menos do que a fase pede:** o job saiu `desatualizada` ou não chegou ao passo (3); a fase não mediu o [C].

## Rodar o cenário da ingestão

`npm run carga:ingestao` roda o cenário "300 apostilas numa noite" (ingestao-do-material, tarefa 9.0; Tech Spec, 7c; PRD, RF15) no mesmo projeto compose (`educa-carga`) dos outros, e o derruba no
fim. Leva uns 10 min, mais a construção das imagens. Não rode junto com o portão, com os testes nem com os outros cenários (`flock /tmp/educa-carga.lock`). O `worker-pdf` do compose de carga é **uma
réplica** (`cpus: 1.5`, um PDF por vez). O cenário cria a rede e as escolas A, B e C pelo `ops:escola`, e as sessões pelo `ops:sessao-sintetica`: três coordenadores da A, um da B e trinta alunos da B.

- **base**: o k6 (`infra/k6/ingestao.js`) só com o Tutor da B, 1,5 turno por segundo, por 2 min. O p95 do turno que o banco registrou (`execucao_agente`, `criada_em` a `concluida_em`) é a régua;
- **ingestao**: o mesmo k6 por 3 min e, dez segundos depois, os três coordenadores da A enviam as **300 apostilas** pela rota real (`POST /v1/materiais`, com o guard e o multipart como a tela manda;
  cada arquivo é o PDF do seed com um comentário final que o torna único), e o coordenador da B envia o PDF dele quando a A já mandou 90%. O cenário espera as 300 extrações.

Passa quando: os 300 envios voltam 201 (os tetos do §7c: 100 por hora por pessoa, 300 por escola, 300 em processamento); as 300 extrações ficam prontas, nenhuma `falhou`; a vazão por PDF
(do primeiro `iniciado_em` ao último `concluido_em` de `job_registro`, fila `pdf`) projeta as 300 dentro das 10 h entre 19h e 5h; o p95 do turno do Tutor da B fica até 500 ms acima da base
(com ao menos 20 turnos em cada janela); nenhum statement do `pg_stat_statements` passa de 1,5 s; e o PDF da B espera no máximo **duas extrações da A** (quantas extrações da A começaram entre o
`criado_em` e o `iniciado_em` do job dela). `npm run carga:ingestao:controle-negativo` sobe com `VAGAS_POR_ESCOLA_DESLIGADAS=true` e só sai verde se o cenário **reprovar pela espera do PDF da B**, com o
envio e a extração limpos: sem a vaga `pdf` por escola, o PDF da B espera atrás da fila inteira da A.

Se reprovar, a saída diz o critério:
- **envio recusado (429):** o guard (`exigirEnvioDentroDosTetos`) está com teto menor que o onboarding. Confira `ENVIOS_POR_USUARIO_NA_JANELA`, `ENVIOS_POR_ESCOLA_NA_JANELA` e `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA`.
- **extração com falha ou pendente:** veja o log do `worker-pdf` (o cenário imprime o fim dos logs). O storage ou o parser de PDF.
- **vazão acima da noite:** a extração de um PDF ficou lenta; confira o `statement_timeout` e o tamanho do PDF do seed (o do cenário tem 14,6 KB: a apostila real é maior, e a conta se refaz com a vazão medida).
- **turno da B acima da base mais 500 ms:** a ingestão disputa CPU ou conexão com o Tutor; confira o pool do `worker-pdf` e os statements.
- **PDF da B atrás de mais de duas extrações:** a vaga `pdf` por escola (`VAGAS_ESCOLA_PDF`, 2) não está separando as escolas. Rode o controle negativo para confirmar que ele continua reprovando.

A corrida de 13/11/2026 está em `tasks/prd-ingestao-do-material/9_task.md`, "A corrida da carga". O cenário vale como registro com as condições de "Quando a carga vale como registro" (a máquina calma; o hash
não entra neste cenário).

## Rodar a carga da manhã

`flock /tmp/educa-carga.lock npm run carga -- --so=sala` roda a carga da manhã (X6, tarefa 11.0; RF6; `docs/infra.md` seção 10) no projeto `educa-carga`, e o derruba no fim. Leva uns 15 min, mais a construção das
imagens. Não rode junto com o portão, com os testes nem com os outros cenários. O compose sobe com o adaptador falso (a carga nunca chama provedor pago: o script recusa outro `IA_ADAPTADOR`), 6 s por turno do Tutor, 50 s por
ferramenta e 3.000 + 250 tokens por chamada, e cria dez escolas com seis turmas, 60 alunos e 2 professoras cada. Aos 75 s ele dá `kill -9` no `worker-ia-1`, e o relatório diz quantas execuções esse
`kill` interrompeu e o teto que ele leu antes. `npm run carga -- --so=base` roda só a base, para a comparação com o build anterior (o mesmo `carga.ts` num `git worktree` do commit de antes).

Se reprovar, a saída diz o critério:
- **`espera_interativa` ou `espera_ferramenta`:** a espera p95 da escola na fila passou de 2 s ou de 10 s. Veja as vagas por escola (`VAGAS_ESCOLA_INTERATIVA`, `VAGAS_ESCOLA_FERRAMENTA`) e os pools do `worker-ia`.
- **`interrompidas_acima_do_teto`:** o `kill -9` interrompeu mais execuções que as `rodando` lidas antes dele: uma execução foi encerrada por outro caminho (a varredura, o corte de 20 s da `pendente`).
- **`kill_sem_efeito`:** o `kill -9` não interrompeu nenhuma execução (o ritmo caiu, ou o worker morto não tinha jobs): a fase não provou a reentrega. Repita.
- **`indisponivel`:** alguma execução terminou `IA_INDISPONIVEL`: o `LLM_TOKENS_POR_MINUTO` da carga está baixo demais para a espera de 8 s do degrau, ou o modelo menor não resolveu.
- **`balde_nao_recusou`:** o balde de tokens não esperou nenhuma reserva, e o teto não foi provado: o `LLM_TOKENS_POR_MINUTO` de `infra/carga.env` ficou acima do balde da carga (1,625 milhão por minuto × 80 %).
- **`falhas_fora_do_kill`:** outro erro além do `EXECUCAO_INTERROMPIDA`. A corrida de 16/11/2026 achou duas causas de montagem: a ferramenta sem trecho (`MATERIAL_INSUFICIENTE`: o tema precisa de palavras que a busca em português ache no capítulo) e 429 do limite geral de 120 pedidos por minuto por pessoa (a consulta da execução a cada 0,5 s; a web consulta a cada 1 s).

O RSS e o pico de conexões do pool saem no relatório. A espera por conexão do pool não tem métrica (`TODO.md`). Vale como registro com as condições da seção seguinte (só a primeira: o cenário não passa pelo hash).

## Quando a carga vale como registro

Os cenários de login, da sala e da importação (`carga:login`, `carga:sala`, `carga:importacao`; o da ingestão, `carga:ingestao`, não passa pelo hash e só pede a primeira condição) medem o p95 de rotas que passam pelo hash de senha, e as duas APIs
do compose de carga têm `cpus: 1` (`infra/compose.carga.yml`). Se o host não entrega a CPU de referência, o hash custa o dobro, o semáforo do hash
passa do prazo e o resultado é 503 e p95 de segundos, **sem que o produto tenha mudado**. Foi assim no K2 da sala (hash a 42 ms, `decidir` a 3.047 e
3.417 ms) e na fase `professores` da validação de `acesso-e-convites` (283 × 503, rajada a 2.123 ms numa corrida e verde na seguinte). Por isso uma rodada
só entra como registro de tarefa, de correção ou de validação com as três condições abaixo, escritas junto do número:

1. **Máquina calma antes de começar.** Nenhum outro compose de pé (`docker ps` vazio, ou só o que o cenário sobe), nenhum portão, e2e ou outro cenário de carga
   rodando em outro andar (a fila é `flock /tmp/educa-carga.lock`, que só enxerga quem a usa), e o load de 1 minuto abaixo de ~2 em 12 núcleos. O load **durante** a
   rodada não serve de critério: o próprio cenário leva o host a 3 ou 4 sozinho (k6, banco, as duas APIs, o worker).
2. **O hash na CPU de referência, antes e depois.** A mediana de 20 hashes seguidos fica **até ~35 ms** (a calibração da Tech Spec da identidade, seção 5, é de ~30 ms):

   ```bash
   node -e "const {hash}=require('@node-rs/argon2');(async()=>{const t=[];for(let i=0;i<20;i++){const a=performance.now();await hash('s',{memoryCost:19456,timeCost:12,parallelism:1});t.push(performance.now()-a)}t.sort((x,y)=>x-y);console.log('mediana',t[10].toFixed(1),'ms; p90',t[18].toFixed(1),'ms')})()"
   ```

   O comando mede **no host**, sem o teto de `cpus: 1` do container da API: diz se o host está disputado, e não é o hash dentro da API. É esta a leitura que separa a falha do host da falha do
   produto, e não o throttling do cgroup: com o host disputado por 16 laços, o throttling das APIs ficou em 6% a 8% e o hash foi a 68 ms. Mediana acima de ~35 ms antes ou depois: a rodada não
   vale, nem verde nem vermelha; repita com a máquina calma. **Só a mediana entra no critério;** o p90 e o máximo ficam registrados (nas rodadas calmas de 10/11 o p90 foi de 30 a 44 ms, e o
   máximo de uma delas passou de 100 ms, por um hash isolado: a tabela "O hash em cada rodada" de `tasks/correcoes/2026-11-10-carga-professores.md`). As duas leituras são **antes e depois**, nunca durante: uma disputa que só aparece no meio da rodada passa por elas. Por isso, vermelho com o
   hash bom nas duas pontas se repete uma vez, com o `cpu.stat` amostrado a cada 5 s; só o segundo vermelho é tratado como defeito do produto.
3. **O throttling das APIs, lido e escrito.** `cpu.stat` de `educa-carga-api-1-1` e `educa-carga-api-2-1` (`docker exec <container> cat /sys/fs/cgroup/cpu.stat`), no começo e no
   fim da fase: a fração `nr_throttled / nr_periods` e o `throttled_usec`. Medido em 10/11/2026 com a máquina calma, por API (`api-1` / `api-2`): rajada sozinha 5,8% / 5,3%; fase `professores` 10,6% / 11,0% e 9,7% / 10,0% (duas rodadas); K2 da sala
   27,8% / 27,0% (que passa, com folga de 135 ms no p95; origem: `tasks/correcoes/2026-11-10-k2-calmo.md`, e as outras, `tasks/correcoes/2026-11-10-carga-professores.md`). Acima da faixa do
   cenário, o resultado vale como "passou com a CPU ainda negada" e leva o número.

Vermelho com as três condições cumpridas **e repetido uma vez** (condição 2) é do produto: é defeito. Vermelho (ou verde) fora das condições é medição, e se repete; o primeiro vermelho não se apaga: fica escrito junto do segundo resultado. **Antes do piloto, a fase `professores` e a rajada rodam também na
VPS de produção (D82), onde o hash `t=12` ainda não foi medido** (`TODO.md`).

## Esteira vermelha no e2e

O e2e roda em **onze fatias**, cada uma num job próprio (`e2e 1/11` a `e2e 11/11`), com o seu compose e
o seu `--shard=<i>/11` do Playwright; uma fatia vermelha não cancela as outras. A quinta entrou em
13/10/2026, com a suíte em 776 casos commitados e 818 com os 42 do e2e da 6.0 da X1: em quatro fatias eram
194 por fatia (uns 27 min, no limite de 27) e 205 (uns 28 min, acima dele); em cinco, 156 e 164 (uns 23 e 24 min;
`tasks/correcoes/2026-10-13-quinta-fatia-do-e2e.md`). A sexta entrou em 16/10/2026, com a suíte em 990 casos
commitados e 1002 com os 12 do e2e da 2.0 de `telas-da-coordenacao`: em cinco fatias eram 198 por fatia só com o
commitado e 201 com a 2.0 (uns 28 min nos dois casos, acima do limite de 27); em seis, 165 e 167 (uns 24 min nos dois;
`tasks/correcoes/2026-10-16-sexta-fatia-do-e2e.md`). A sétima entrou em 19/10/2026, com a suíte em 1178 casos
na linha 3 de `telas-do-professor` e 1196 com a spec somada a ela: em seis fatias eram 197 por fatia só com a
linha (uns 27 min, no limite) e 200 com a soma (uns 28 min, acima dele); em sete, 169 e 171 (uns 24 min nos dois;
`tasks/correcoes/2026-10-19-setima-fatia-do-e2e.md`). A oitava entrou em 25/10/2026, com a suíte em 1384 casos: em sete
fatias eram 198 por fatia (uns 28 min, acima do limite de 27); em oito, 173 (uns 25 min;
`tasks/correcoes/2026-10-25-oitava-fatia-do-e2e.md`). A nona entrou em 05/11/2026, com a suíte em 1562 casos commitados e 1580
com os 18 do e2e da 14.0 de `onboarding-por-convite` (9 casos nos dois projetos): em oito fatias eram 196 por fatia só com o
commitado (uns 27 min, no limite) e 198 com a 14.0 (uns 28 min, acima dele); em nove, 176 (uns 25 min;
`tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`). A décima entrou em 08/11/2026, com a suíte em 1762 casos
commitados e 1800 com os 38 do e2e da 6.0 de `acesso-e-convites` (19 casos nos dois projetos): em nove fatias eram 196 por
fatia só com o commitado (uns 27 min, no limite) e 200 com a 6.0 (uns 28 min, acima dele); em dez, 180 (uns 25 min;
`tasks/correcoes/2026-11-08-e2e-decima-fatia.md`). A décima primeira entrou em 12/11/2026, com a suíte em 1962 casos
commitados e 1974 com os 12 do e2e da 6.0 de `ingestao-do-material` (6 casos nos dois projetos): em dez fatias eram 197 por
fatia só com o commitado (uns 27 min, no limite) e 198 com a 6.0 (uns 28 min, acima dele); em onze, 180 (uns 25 min;
`tasks/correcoes/2026-11-12-e2e-fatia-acima-do-teto.md`). Em onze fatias o limite continua 197 casos por fatia, 2167 no
total, cerca de 190 a mais que os 1974 de hoje: é o ponto em que a décima segunda fatia passa a ser pedida. O total de fatias está
escrito em quatro lugares: a matriz, o `name` do job e o `--shard` do passo em `.github/workflows/ci.yml`, e
`FATIAS_DO_E2E` em `tools/processo/esteira.ts`, que o censo lê. Cada fatia publica o
diretório de saída do Playwright quando falha ou é cancelada: artefato **`traco-do-e2e-<i>`**, com o
número da fatia, `trace.zip` e `error-context.md` do caso que falhou, por 7 dias. (O nome, o prazo e o
caminho são afirmados em `tools/ci/esteira.test.ts`; se renomearem o artefato, é lá que o vermelho
aparece, e esta seção precisa acompanhar.)
Baixe com `gh run download <id> --name traco-do-e2e-<i>` e abra com `npx playwright show-trace <arquivo>`:
é ele que tem a linha de tempo das requisições e diz se o prazo foi numa resposta lenta da API, numa
tentativa rebaixada na fila do login ou na tela que não chegou a montar.

Sem artefato na execução falha, o vazio é sinal por si: ou a configuração do traço mudou
(`playwright.config.ts`), ou o compose não subiu — o passo avisa com `if-no-files-found: warn`.
O caso morto pelo estouro de `timeout-minutes` não deixa traço finalizado; aí o que resta é o log dos
serviços no próprio job.

Vermelho de e2e que não reproduz na máquina segura a tarefa seguinte (regra 40, D52): trate como
defeito pela correção (`corrigir`), com a causa achada no traço, e não repetindo a execução até passar. Para
repetir só a fatia na máquina: `node tools/ci/e2e.ts --shard=<i>/11`, que sobe o compose limpo como a
esteira. A fatia começa com o banco vazio e roda só a parte dela: caso que passa na suíte inteira e
falha na fatia depende de outro spec ter rodado antes, e isso é o defeito.

**Job `cancelled` com a suíte verde é o teto, não um teste.** O sinal: nenhum `✘` no log da fatia, o
último caso terminado segundos antes de `The operation was canceled`, e o job com a duração do
`timeout-minutes` do e2e em `.github/workflows/ci.yml`. Repetir a execução não resolve, porque a suíte
só cresce: o job único de 394 casos foi cancelado assim duas vezes seguidas aos 45 min, e por isso o e2e
foi repartido (`tasks/correcoes/2026-10-03-e2e-em-fatias.md`). Cada fatia custa uns 4 min fixos, a
maior parte na subida do compose, e até 7 s de relógio por caso; caso de tela com muita ida à API custa
mais que o dobro.

Dois sinais chegam antes do cancelamento. `tools/ci/esteira.test.ts` refaz a conta com os casos de cada
fatia e reprova no portão local e no job `unidade` quando uma delas passa de 60% do teto, mesmo pela
média. E `tools/ci/e2e.ts` mede a etapa de testes de cada fatia e, quando ela passa desse limiar (60% do
teto menos o custo fixo), deixa a anotação **"e2e perto do teto"** no resumo da execução, mesmo verde.
Qualquer um dos dois pede mais fatias: acrescentar o número à `matrix.fatia` e trocar o total (hoje `/11`)
pelo novo no `name` do job e no passo `npm run ci:e2e`, e acrescentar o número a `FATIAS_DO_E2E`; a guarda confere
os três contra o tamanho da matriz. Subir o `timeout-minutes` ou baixar as
constantes de `tools/ci/prazo-do-e2e.ts` para o teste passar não é saída.

**O artefato é público**, porque o repositório é. Ele é inofensivo hoje por construção: todo dado do
e2e é sintético, e o ambiente do compose de teste sai só de `.env.example` e `infra/teste.env`, os dois
versionados, sem ler nada do runner (`tools/ci/compose.ts`). Por isso, **nada além da saída do
Playwright deve ser escrito em `test-results/`** — despejo de log de serviço, dump ou material
licenciado de fixture mudariam a classe do que se publica, e aí a decisão de publicar precisa ser
tomada de novo, com o `privacy-guardian`. O mesmo vale para o relatório do censo
(`censo-do-e2e-<i>`, o `censo-do-e2e.json`), que também é público, inclusive na execução de pull request de fork, e leva o
`stdout`, o `stderr` e os `errors` de cada caso: um `console.log` de fixture com dado real vazaria por ali.

## Esteira vermelha na infra

A infra roda em **três fatias**, cada uma num job próprio (`infra 1/3` a `infra 3/3`), com o seu compose e o seu `--shard=<i>/3` do
Vitest, que reparte os arquivos de `infra/test` por hash do caminho; uma fatia vermelha não cancela as outras. O projeto roda um
arquivo por vez (os testes param e religam serviços), e a soma deles chegou a 42,5 min num runner só, com o `alertas.int.test.ts`
sozinho em 18,5: o job único foi cancelado no teto de 45 min com testes por rodar (execução 43325031136;
`tasks/correcoes/2026-11-12-job-de-infra-passa-de-45-min.md`). Em três fatias a mais longa leva uns 25 min. Cancelada sem push novo é
o prazo: some a duração de cada arquivo no log da fatia (`gh run view <id> --log`) e, passando dos 30 min, acrescente fatia em vez de
subir o `timeout-minutes`. O total de fatias está escrito em três lugares do `.github/workflows/ci.yml`: a matriz, o `name` do job e o
`--shard` do passo. Localmente, `npm run ci:infra` roda tudo, e `npm run ci:infra -- --shard=<i>/<n>` roda uma fatia.

## Esteira vermelha no `verificar` ou na unidade

O job `verificar` (tipos, lint, guardas, segredo, dependências e o git hook) e os dois da unidade (`unidade 1/2` e `unidade 2/2`, o Vitest repartido por arquivo, por hash do caminho) têm teto de 15 min
cada. A unidade já esteve dentro do `verificar`: o job levava de 10 a 12,5 min e, numa execução em que todas as etapas ficaram uns 45% mais lentas no runner (`tsc` 86 → 126 s, `eslint` 88 → 123 s, unidade
387 → 577 s, sem arquivo nem teste novo), foi cancelado aos 15 min com tudo verde (execução 43965073602; `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`). Cancelada sem push novo é o prazo: compare as
etapas com as de uma execução verde (`gh run view <id> --log`), porque lentidão uniforme é do runner, e a que cresce sozinha é a que se corrige. Passando dos 7 min de teste numa fatia da unidade, acrescente
fatia (a matriz, o `/2` do `name` e o do passo em `.github/workflows/ci.yml`) em vez de subir o `timeout-minutes`. Localmente, `npm run ci:unidade` roda tudo, e `npm run ci:unidade -- --shard=<i>/<n>` roda uma fatia.

## Buscar um erro no log pelo `tipo`

O erro que sai no log traz o campo `tipo`, que é o nome da classe do erro (`summarizeError`, `packages/core/src/error/summarize-error.ts`);
o do banco sai como `ErroDoPostgres`, com o `sqlstate`. Na renomeação para os nomes de mercado (X8, novembro de 2026) 20 classes
mudaram de nome, e **o `tipo` mudou com elas**. Busca de log salva, painel ou alerta que filtre pelo nome da esquerda deixa de
casar, sem erro nenhum: troque pelo da direita. Para olhar um período anterior à troca, procure pelos dois. Nenhuma regra de alerta
filtra pelo `tipo` antigo do log (conferido por `tools/guardas/runbook-tipo-do-log.test.ts`); o `tipo` das regras é rótulo de métrica.

| `tipo` antigo | `tipo` novo | Onde nasce |
|---|---|---|
| `ArgumentoInvalido` | `InvalidArgumentError` | comando de operação (`apps/api/src/ops/command.ts`) |
| `ArmazemIndisponivel` | `FileStorageUnavailableError` | storage de arquivo (`packages/core/src/titular/file-storage.ts`) |
| `AuditoriaRecusada` | `AuditoriaRejectedError` | gravação ou leitura de auditoria recusada (erro de programação) |
| `ConfiguracaoInvalida` | `InvalidConfigError` | validação da configuração na subida |
| `DesativacaoRecusada` | `DesativacaoRejectedError` | comando de operação que desativa (`apps/api/src/ops/operador.ts`) |
| `ErroDeDominio` | `DomainException` | regra de negócio recusada |
| `ErroDeIa` | `LLMError` | camada de IA (código de erro da IA, sem texto livre) |
| `ErroDeInvariante` | `InvariantException` | invariante quebrada |
| `ErroDoProvedor` | `ProviderError` | adaptador do provedor de IA (falha de tempo ou indisponibilidade) |
| `ErroParaAFila` | `QueueFacingError` | erro do worker que vai ao Redis só com o código |
| `FalhaDeJob` | `JobFailureError` | falha prevista de um processador de job |
| `MapaDeAuditoriaInvalido` | `InvalidAuditoriaMapError` | mapa de ações de auditoria na subida |
| `MaterialSemConteudoAproveitavel` | `MaterialSemConteudoAproveitavelError` | tarefa de IA que não achou nos trechos nada de que tirar a saída |
| `MigracaoFalhou` | `MigrationFailedError` | migração de banco |
| `OperadorRecusado` | `OperadorRejectedError` | comando de operação recusado |
| `PedidoDeJobRecusado` | `JobRequestRejectedError` | `JobOutbox` recusou o pedido antes de gravar |
| `PrazoDaFilaEsgotado` | `QueueTimeoutError` | despachante, fila de Redis que não respondeu |
| `ProvedorExternoFalhou` | `ExternalProviderError` | conta Google ou Microsoft da escola (D48) |
| `RotasSemPermissao` | `RoutesWithoutPermissaoError` | rota sem permissão declarada, na subida |
| `SegredoNaoDecifra` | `SecretDecryptionError` | credencial da escola que não decifra |

O `codigo_falha` de `job_registro` (`TEMPO_ESGOTADO` e os outros) não mudou: é um código, e não o nome de uma classe.

## Como avisar as escolas

*A definir antes do piloto:* canal (e-mail para a coordenação, aviso na tela), texto padrão
para queda e para retorno, e quem autoriza estender prazo de prova afetada.
