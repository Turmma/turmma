# Tarefa 6.0 — A aba Licenças e o aviso `licenca-vencendo` no sino

**Funcionalidade:** ingestao-do-material · **Depende de:** 5.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Licenças, dentro de Material, a coordenação vê cada licença com situação e materiais, registra uma nova e muda a
vigência sabendo quantos materiais saem ou voltam da busca; o sino avisa 30 dias antes do fim, e quando venceu com
material.

## Contexto necessário

- `techspec.md` §4 (`/v1/licencas`), §9 (linhas Licenças e Sino)
- `prd.md` RF16, RF17
- `cenarios.md` "Telas" (Licenças, Sino, textos), "Licença" (o [U] do sino)
- `docs/interface.md`: a aba Material e o sino ("cinco tipos")
- `.claude/rules/`: 20 (item 4), 40, 50 (tela)
- Código: `apps/web/src/areas/coordenacao/material/Material.tsx` (as abas); `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts`
  (`TIPOS_DA_FILA`, l.26) e `SinoDaCoordenacao.tsx`; `apps/web/src/paths.ts` (`COORDENACAO_ROUTES.material`, `MATERIAL_PARAM`)

## Subtarefas

- [x] 6.1 — `apps/web/src/areas/coordenacao/material/api/licencas.ts` (`licencasQueryOptions`, mutações)
- [x] 6.2 — Aba Licenças: lista com situação em texto e cor, datas dd/mm/aaaa com rótulo, contagem de materiais; as "registradas antes da F4" destacadas para revisão (R6); os quatro estados
- [x] 6.3 — Registrar (diálogo, botão trava durante o envio, `ENTRADA_INVALIDA` no campo) e mudar a vigência (mostra quantos materiais saem ou voltam antes de confirmar)
- [x] 6.4 — Sino: o tipo `licenca-vencendo`, de −30 a 0 dias e vencida com material; "Uma licença de material vence em dd/mm" e "Uma licença de material venceu; os materiais dela saíram da busca"; leva à aba; sem licenciante nem número por pessoa; sem reler por tempo
- [x] 6.5 — `docs/interface.md`: a aba Licenças e os seis tipos do sino; `grep -rn 'cinco tipos' apps/web/src e2e docs`
- [x] 6.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/material/api/licencas.ts`, `apps/web/src/areas/coordenacao/material/Licencas.tsx`, `apps/web/src/areas/coordenacao/material/Licencas.test.tsx`, `apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx`, `apps/web/src/areas/coordenacao/material/licencas.ts`, `apps/web/src/areas/coordenacao/material/licencas.test.ts`, `e2e/material-licencas.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/paths.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts`, `apps/web/src/areas/coordenacao/painel/SinoDaCoordenacao.tsx`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| estados: carregando, erro, vazio, com dado | U | o vazio só com a leitura terminada e sem erro | `Licencas.test.tsx` › os quatro estados da tela (carregando, erro, vazio, com dado; a releitura que cai com a lista vazia; a releitura que falha com a lista na tela) |
| situação em texto e cor, uma de cada | U | as quatro `situacao` | `licencas.test.ts` › %s: o texto e a família que a tela mostra (um por situação); `Licencas.test.tsx` › uma de cada situação, em texto e na cor da família dela |
| datas | U | dd/mm/aaaa, com rótulo | `licencas.test.ts` › dd/mm/aaaa pelo texto…; `Licencas.test.tsx` › as datas em dd/mm/aaaa, cada uma com o rótulo; sem fim, "Sem data de fim" |
| "registradas antes da F4" | U | destacadas (R6) | `Licencas.test.tsx` › as criadas automaticamente são destacadas para revisão, e só elas; a faixa diz quantas; a licença criada automaticamente diz "Documento: não informado", e a tela não mostra o nome de fase nem de migração; duas ou mais licenças criadas automaticamente: a faixa diz quantas, no plural; sem nenhuma licença criada automaticamente, sem a faixa |
| `PATCH` da vigência | U | mostra quantos materiais saem ou voltam antes de confirmar | `Licencas.test.tsx` › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH; a licença vencida com o fim levado para frente: os materiais voltam |
| clique duplo em registrar | U | um `POST` só | `Licencas.test.tsx` › clique duplo em registrar: um POST só; o diálogo fechado com o pedido no ar: o botão da tela fica desligado; `e2e/material-licencas.spec.ts` › a falha do registro… (com a resposta lenta o botão fica desligado e sai um pedido só; o clique duplo em si é do caso de unidade) |
| `ENTRADA_INVALIDA` | U | o erro no campo | `Licencas.test.tsx` › ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido |
| sino: −31 dias | U | sem aviso | `fila-da-coordenacao.test.ts` › a 31 dias do fim: sem aviso |
| sino: −30, 0 e +1 dias | U | avisa (um caso cada) | `fila-da-coordenacao.test.ts` › a 30 dias do fim; no último dia (0); um dia depois do fim (+1) e com material (um caso cada) |
| sino: vencida sem material | U | não avisa | `fila-da-coordenacao.test.ts` › vencida sem material: não avisa, porque nada depende dela |
| sino: depois do `PATCH` da vigência | U | o item some | `fila-da-coordenacao.test.ts` › o aviso sai quando a vigência muda; `SinoDaCoordenacao.test.tsx` › depois da mudança da vigência, o item some; `e2e/material-licencas.spec.ts` › cada situação em texto… o aviso do sino leva à aba e some |
| textos do sino | U | sem licenciante nem número por pessoa; leva à aba | `fila-da-coordenacao.test.ts` › um item por licença, com ids distintos, e o texto não leva licenciante nem número; `SinoDaCoordenacao.test.tsx` › uma licença que vence… e leva à aba Licenças |
| isolamento | E | a coordenação da A não vê licença da B, nem no sino | `e2e/material-licencas.spec.ts` › segunda pessoa: a coordenação de B entra na aba da de A, e nem a lista nem o sino de B trazem a licença de A |
| permissão: professor | E | não vê a aba | `e2e/material-licencas.spec.ts` › o professor não alcança a aba: o endereço cai em "não encontrada", sem pedido de licenças |
| recomeço: segunda pessoa na aba; registrar de novo; resposta atrasada; falha com o diálogo aberto | E | o cache da anterior sai; o foco e o aviso da tentativa anterior saem | `e2e/material-licencas.spec.ts` › segunda pessoa… (o cache da anterior sai) e › a falha do registro… (fechar e reabrir: o foco e o aviso saem); `Licencas.test.tsx` › a sessão que troca (o diálogo fecha; a troca de sessão apaga o anúncio do registro da pessoa anterior; e a falha do registro que chegou com o diálogo fechado); a resposta atrasada não fecha o diálogo de outra abertura |
| registrar e ver na lista | E | fim a fim | `e2e/material-licencas.spec.ts` › a aba abre pelo caminho da pessoa, o vazio convida a registrar, e o formulário incompleto diz o que falta sem pedido à API (o vazio e o formulário) e › o registro entra na lista com a situação em texto, e a página não rola (o registro fim a fim) |
| cabe em 1366 × 768 | E | `paginaNaoRola` | `e2e/material-licencas.spec.ts` › o registro entra na lista com a situação em texto, e a página não rola (`paginaNaoRola` depois do registro) e › cada situação em texto, a vigência mostra o que muda na busca antes de salvar… (com seis licenças) |

## Como testar

- Tela: `apps/web/src/areas/coordenacao/material/Material.test.tsx` › "o envio com licença: o PDF sobe, o diálogo fecha…" (l.533), com o `montar(endereco)` do arquivo
- Sino: `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts` › "os cinco tipos viram item, com o endereço certo…": vira seis
- e2e: `e2e/material.spec.ts` › "a coordenação sobe o PDF de demonstração…"; `e2e/support/coordenacao.ts` (`irPelaCoordenacao`, `linhasDaTabela`, `paginaNaoRola`)
- Relógio: `page.clock` parado para os dias do sino
- Comandos: `npx vitest run --project unidade apps/web/src/areas/coordenacao/material/Licencas.test.tsx`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-licencas.spec.ts`
- Armadilha: asserção de ausência ("não avisa") só depois da resposta de `/v1/licencas` chegar
- **Telas:** `coordenacao`, `/coordenacao/material` › `text=Licenças` (vazia, com as quatro situações, diálogo de registrar); o sino aberto, com um aviso de cada texto

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 2: `grep -rln
'Licenças' e2e/`. Na 5: o "não avisa" espera a resposta. Na 10: os dias do sino com `page.clock`, num sábado também.

## Fora do escopo desta tarefa

A escolha da licença no envio (7.0).

## Divergências resolvidas nesta tarefa

nenhuma. A Tech Spec (§9) diz só "Licenças (aba de Material)" e "leva a Licenças": o **endereço** da aba, `?aba=licencas` (sem o parâmetro abre Materiais), é decisão de desenho desta tarefa, que cabe nas duas linhas e está em `docs/interface.md`; o parâmetro é de lista fechada, nunca nome (regra 20, item 9). Fora da lista de arquivos previstos, o título do aviso do sino "Uma licença de material venceu; os materiais dela saíram da busca" saía cortado em reticências (visto na vitrine, a 1366 px e pior a 360 px), e por isso `ListItem` e `Sino` ganharam a prop opcional `tituloInteiro` (o título quebra em quantas linhas precisar), ligada só nos dois avisos de licença, com a linha no catálogo de `docs/interface.md` 10.2 e um caso de teste em cada peça. As quatro observações da revisão da 5.0 entraram assim: (a) nenhuma regra da tela bloqueia ou esconde material do aluno, a tela só diz o que a situação da API faz com a busca e o que a vigência nova faria; (b) o aviso dos 30 dias fica no sino, sem notificação do navegador nem leitura por tempo (D59); (c) o botão do registro fica desligado enquanto o `POST` corre; (d) a frase de `docs/regulacao.md` §5 ("Licença ou parceria…") foi conferida contra a tela e atualizada.

## Mutações

--faltando: 4 linhas (125 blocos, 4 motivos)

Um bloco por cláusula do que a tarefa acrescenta na web: as datas, a situação em texto e em cor e cada rótulo do `switch` (`licencas.ts`), o efeito da vigência (o conjunto da busca, cada termo de `saem` e `voltam`, a frase de cada tipo no singular e no plural), os formulários (cada campo, o espaço aparado, o `>=` do fim, o fim vazio como nulo, o pedido que o contrato recusa), o diálogo de registro (o `ENTRADA_INVALIDA` no campo do fim, a falha que não leva a ele, o foco no primeiro campo com erro), o diálogo da vigência (o que a API recusou, a licença que saiu da lista, o fim vazio de uma licença sem fim), a aba (os quatro estados, a releitura que cai com a lista vazia, o foco devolvido ao título, o botão que trava, a faixa da migração no singular e no plural, a falha do registro com o diálogo fechado), o endereço da aba (`?aba=`), a API (método, corpo e caminho) e o sino (cada termo das duas condições, o id por licença, o endereço, e o título inteiro: a prop do `ListItem`, a do item do sino e a que a fila liga nos dois avisos). As quatro linhas que o `--faltando` lista têm motivo, e cada uma é uma conferência que o contrato (`packages/shared`) repete, de modo que nenhum cenário as separa: (1) `if (pedido !== undefined) aoEnviar(pedido)` do diálogo de registro só é falsa se o contrato recusar o que o formulário já conferiu campo a campo (`errosDoRascunhoDaLicenca` e os `maxLength` dos campos), e nenhum cenário alcança esse ramo sem tirar um dos dois; (2) `Object.keys(errosDaVigencia(rascunho)).length === 0 &&` do diálogo da vigência: o `pedidoDeVigencia` já é `undefined` quando a vigência está fora de ordem, porque o `alterarLicencaRequestSchema` recusa o mesmo que `errosDaVigencia`, então tirar o termo deixa o `PATCH` sem sair do mesmo jeito; (3) e (4) `return lido.success ? lido.data : undefined` de `pedidoDeRegistro` e de `pedidoDeVigencia`: o `safeParse` que falha tem `data` indefinido, e `return lido.data` devolve o mesmo valor, de modo que a troca não muda nada que a tela ou um teste veja. A chave de cache das licenças (`LICENCAS_QUERY_KEY`) e o `true &&` antes de `listChanged` no diálogo da vigência também não ganham bloco: a chave só precisa ser diferente da lista de materiais, e `['material']` e `['material', 'licencas']` o são; o `listChanged(null, …)` é falso, então `mutacao.isError &&` só repete o que ele já diz (a troca de `mutacao.isError` sozinho, que muda o resultado, tem o seu bloco).

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › dd/mm/aaaa pelo texto, sem passar pelo fuso: o dia 1 não volta para o dia anterior
-return `${dia}/${mes}/${ano}`
+return `${mes}/${dia}/${ano}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › dd/mm, para o aviso do sino
-return dataDaLicenca(data).slice(0, 5)
+return dataDaLicenca(data).slice(0, 6)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o dia de hoje é o de São Paulo: às 23h30 do último dia ainda é ele; às 0h01 do seguinte, não
-return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
+return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › só a referência que a migração escreveu a destaca
-return licenca.referencia === REFERENCIA_DA_MIGRACAO
+return licenca.referencia.includes(REFERENCIA_DA_MIGRACAO)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vigente: o texto e a família que a tela mostra
-return 'Vigente'
+return 'Ativa'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vence_em_30_dias: o texto e a família que a tela mostra
-return licenca.vigenteAte === null ? 'Vigente' : `Vence em ${dataDaLicenca(licenca.vigenteAte)}`
+return licenca.vigenteAte === null ? 'Vigente' : `Vence ${dataDaLicenca(licenca.vigenteAte)}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vencida: o texto e a família que a tela mostra
-return licenca.vigenteAte === null ? 'Vencida' : `Vencida em ${dataDaLicenca(licenca.vigenteAte)}`
+return licenca.vigenteAte === null ? 'Vencida' : `Vencida ${dataDaLicenca(licenca.vigenteAte)}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › futura: o texto e a família que a tela mostra
-return `Começa em ${dataDaLicenca(licenca.vigenteDesde)}`
+return `Começa ${dataDaLicenca(licenca.vigenteDesde)}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vigente: o texto e a família que a tela mostra
-vigente: 'ok',
+vigente: 'info',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vencida: o texto e a família que a tela mostra
-vencida: 'erro',
+vencida: 'pendente',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › quantos materiais, por extenso, no singular e no plural
-return materiais === 0 ? 'Nenhum material' : materiais === 1 ? '1 material' : `${String(materiais)} materiais`
+return materiais === 0 ? '0 materiais' : materiais === 1 ? '1 material' : `${String(materiais)} materiais`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › quantos materiais, por extenso, no singular e no plural
-return materiais === 0 ? 'Nenhum material' : materiais === 1 ? '1 material' : `${String(materiais)} materiais`
+return materiais === 0 ? 'Nenhum material' : materiais === 1 ? '1 materiais' : `${String(materiais)} materiais`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o que a situação faz com a busca: a vencida diz que os materiais saíram, a futura que entram no dia do começo
-if (licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias') return 'Os materiais dela estão na busca.'
+if (false || licenca.situacao === 'vence_em_30_dias') return 'Os materiais dela estão na busca.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › uma de cada situação, em texto e na cor da família dela, e o que ela faz com a busca
-if (licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias') return 'Os materiais dela estão na busca.'
+if (licenca.situacao === 'vigente' || false) return 'Os materiais dela estão na busca.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o que a situação faz com a busca: a vencida diz que os materiais saíram, a futura que entram no dia do começo
-if (licenca.materiais === 0) return 'Nenhum material depende desta licença.'
+if (false) return 'Nenhum material depende desta licença.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o que a situação faz com a busca: a vencida diz que os materiais saíram, a futura que entram no dia do começo
-return licenca.situacao === 'vencida' ? 'Os materiais dela saíram da busca. Atualize a vigência para eles voltarem.' : 'Os materiais dela entram na busca no dia em que ela começa.'
+return licenca.situacao !== 'vencida' ? 'Os materiais dela saíram da busca. Atualize a vigência para eles voltarem.' : 'Os materiais dela entram na busca no dia em que ela começa.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o fim de hoje ainda vale: o material sai só no dia seguinte, e nada muda agora
-const NA_BUSCA: ReadonlySet<SituacaoDaLicenca> = new Set<SituacaoDaLicenca>(['vigente', 'vence_em_30_dias'])
+const NA_BUSCA: ReadonlySet<SituacaoDaLicenca> = new Set<SituacaoDaLicenca>(['vigente'])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o fim de hoje ainda vale: o material sai só no dia seguinte, e nada muda agora
-const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
+const tipo = estavaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vencida que continua vencida, e vigente que continua vigente: nenhum material muda de lugar
-const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
+const tipo = !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o fim de hoje ainda vale: o material sai só no dia seguinte, e nada muda agora
-const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
+const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : ficaNaBusca ? 'voltam' : 'nenhum'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vencida que continua vencida, e vigente que continua vigente: nenhum material muda de lugar
-const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
+const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca ? 'voltam' : 'nenhum'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › sem material, a frase não promete saída nem volta: a vigência só vale para os que vierem
-if (efeito.materiais === 0) return 'Nenhum material usa esta licença ainda: a vigência só vale para os que vierem depois.'
+if (false) return 'Nenhum material usa esta licença ainda: a vigência só vale para os que vierem depois.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-return `${quantos} ${efeito.materiais === 1 ? 'sai' : 'saem'} da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.`
+return `${quantos} ${efeito.materiais === 1 ? 'saem' : 'sai'} da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-return `${quantos} ${efeito.materiais === 1 ? 'sai' : 'saem'} da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.`
+return `${quantos} ${efeito.materiais === 1 ? 'sai' : 'saem'} da busca do Assistente e do Tutor. `
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-return `${quantos} ${efeito.materiais === 1 ? 'volta' : 'voltam'} à busca do Assistente e do Tutor, sem reenviar.`
+return `${quantos} ${efeito.materiais === 1 ? 'voltam' : 'volta'} à busca do Assistente e do Tutor, sem reenviar.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-return `${quantos} ${efeito.materiais === 1 ? 'continua' : 'continuam'} onde ${efeito.materiais === 1 ? 'está' : 'estão'} na busca: esta vigência não muda isso.`
+return `${quantos} ${efeito.materiais === 1 ? 'continuam' : 'continua'} onde ${efeito.materiais === 1 ? 'está' : 'estão'} na busca: esta vigência não muda isso.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-return `${quantos} ${efeito.materiais === 1 ? 'continua' : 'continuam'} onde ${efeito.materiais === 1 ? 'está' : 'estão'} na busca: esta vigência não muda isso.`
+return `${quantos} ${efeito.materiais === 1 ? 'continua' : 'continuam'} onde ${efeito.materiais === 1 ? 'estão' : 'está'} na busca: esta vigência não muda isso.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vazio, falta cada campo, com a frase que diz o que fazer
-if (rascunho.vigenteDesde === '') erros.vigenteDesde = 'Escolha o dia em que a licença começa.'
+if (false) erros.vigenteDesde = 'Escolha o dia em que a licença começa.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o fim antes do começo é erro do campo do fim; o fim vazio
-else if (rascunho.vigenteAte !== '' && vigenciaInvalida(rascunho.vigenteDesde, rascunho.vigenteAte)) erros.vigenteAte = TEXTO_DA_VIGENCIA_INVERTIDA
+else if (true && vigenciaInvalida(rascunho.vigenteDesde, rascunho.vigenteAte)) erros.vigenteAte = TEXTO_DA_VIGENCIA_INVERTIDA
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o fim antes do começo é erro do campo do fim; o fim vazio
-else if (rascunho.vigenteAte !== '' && vigenciaInvalida(rascunho.vigenteDesde, rascunho.vigenteAte)) erros.vigenteAte = TEXTO_DA_VIGENCIA_INVERTIDA
+else if (rascunho.vigenteAte !== '' && false) erros.vigenteAte = TEXTO_DA_VIGENCIA_INVERTIDA
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vazio, falta cada campo, com a frase que diz o que fazer
-if (rascunho.licenciante.trim() === '') erros.licenciante = 'Diga quem deu a licença: a editora, o sistema de ensino ou o autor.'
+if (false) erros.licenciante = 'Diga quem deu a licença: a editora, o sistema de ensino ou o autor.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vazio, falta cada campo, com a frase que diz o que fazer
-if (rascunho.cobertura.trim() === '') erros.cobertura = 'Diga o que a licença cobre.'
+if (false) erros.cobertura = 'Diga o que a licença cobre.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vazio, falta cada campo, com a frase que diz o que fazer
-if (rascunho.referencia.trim() === '') erros.referencia = 'Indique o documento: o número do contrato ou do termo. Não anexe o contrato.'
+if (false) erros.referencia = 'Indique o documento: o número do contrato ou do termo. Não anexe o contrato.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › só espaços não é preenchido
-if (rascunho.licenciante.trim() === '') erros.licenciante = 'Diga quem deu a licença: a editora, o sistema de ensino ou o autor.'
+if (rascunho.licenciante === '') erros.licenciante = 'Diga quem deu a licença: a editora, o sistema de ensino ou o autor.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › só espaços não é preenchido
-if (rascunho.cobertura.trim() === '') erros.cobertura = 'Diga o que a licença cobre.'
+if (rascunho.cobertura === '') erros.cobertura = 'Diga o que a licença cobre.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › só espaços não é preenchido
-if (rascunho.referencia.trim() === '') erros.referencia = 'Indique o documento: o número do contrato ou do termo. Não anexe o contrato.'
+if (rascunho.referencia === '') erros.referencia = 'Indique o documento: o número do contrato ou do termo. Não anexe o contrato.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o pedido de registro segue o contrato: o fim vazio vai como nulo, e os textos vão aparados
-vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte,
+vigenteAte: rascunho.vigenteAte,
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o pedido da vigência: o fim vazio tira o fim
-const lido = alterarLicencaRequestSchema.safeParse({ vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte })
+const lido = alterarLicencaRequestSchema.safeParse({ vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte })
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › a vigência do rascunho só existe completa e em ordem: é o que a conta do efeito lê
-if (Object.keys(errosDaVigencia(rascunho)).length > 0) return undefined
+if (false) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › a vigência do rascunho só existe completa e em ordem: é o que a conta do efeito lê
-return { vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte }
+return { vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › aba=licencas abre a aba Licenças, selecionada; sem o parâmetro abre Materiais
-return new URLSearchParams(busca).get(ABA_DO_MATERIAL_PARAM) === 'licencas' ? 'licencas' : 'materiais'
+return new URLSearchParams(busca).get(ABA_DO_MATERIAL_PARAM) !== 'licencas' ? 'licencas' : 'materiais'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › trocar de aba troca só o parâmetro, e a aba Materiais não lê licenças
-aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, id === 'licencas' ? 'licencas' : undefined), { replace: true })}
+aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, 'licencas'), { replace: true })}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › aba=licencas abre a aba Licenças, selecionada; sem o parâmetro abre Materiais
-{ativa === 'licencas' ? <Licencas /> : <MateriaisDaEscola />}
+{ativa !== 'licencas' ? <Licencas /> : <MateriaisDaEscola />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um dia depois do fim
-if (licenca.situacao === 'vence_em_30_dias' && licenca.vigenteAte !== null) {
+if (licenca.situacao !== 'vigente' && licenca.vigenteAte !== null) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › a 30 dias do fim: avisa, com o dia e o mês do fim
-if (licenca.situacao === 'vence_em_30_dias' && licenca.vigenteAte !== null) {
+if (false && licenca.vigenteAte !== null) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › vencida sem material: não avisa, porque nada depende dela
-if (licenca.situacao === 'vencida' && licenca.materiais > 0) {
+if (licenca.situacao === 'vencida') {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um dia depois do fim
-if (licenca.situacao === 'vencida' && licenca.materiais > 0) {
+if (false && licenca.materiais > 0) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › vencida sem material: não avisa, porque nada depende dela
-if (licenca.situacao === 'vencida' && licenca.materiais > 0) {
+if (licenca.situacao === 'vencida' && licenca.materiais >= 0) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um item por licença, com ids distintos, e o texto não leva licenciante nem número
 if (licenca.situacao === 'vence_em_30_dias' && licenca.vigenteAte !== null) {
 return [
 {
-id: `licenca-${licenca.id}`,
+id: `licenca-vencendo`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um item por licença, com ids distintos, e o texto não leva licenciante nem número
 if (licenca.situacao === 'vencida' && licenca.materiais > 0) {
 return [
 {
-id: `licenca-${licenca.id}`,
+id: `licenca-vencendo`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › a 30 dias do fim: avisa, com o dia e o mês do fim
-titulo: `Uma licença de material vence em ${diaEMesDaLicenca(licenca.vigenteAte)}`,
+titulo: `Uma licença de material vence em ${diaEMesDaLicenca(licenca.vigenteDesde)}`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › a 30 dias do fim: avisa, com o dia e o mês do fim
 detalhe: 'Atualize a vigência antes do fim, ou os materiais dela saem da busca.',
 urgente: false,
 tituloInteiro: true,
-para: caminhoDasLicencas(),
+para: '/material',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um dia depois do fim
 detalhe: 'Atualize a vigência para eles voltarem.',
 urgente: false,
 tituloInteiro: true,
-para: caminhoDasLicencas(),
+para: '/material',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/SinoDaCoordenacao.test.tsx › uma licença que vence: o sino conta 1, o item diz o dia e o mês, sem licenciante nem número, e leva à aba Licenças
-...itensDeLicenca(lida(licencas) ?? []),
+
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a releitura que cai com a lista ainda vazia não afirma o vazio: o registro que falhou, com a leitura seguinte também falhando, mostra o erro e "Tentar de novo"
-const entradaInvalida = erro instanceof ApiError && erro.codigo === ErrorCode.ENTRADA_INVALIDA
+const entradaInvalida = erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha com o diálogo aberto: o aviso no alerta; ao fechar e abrir de novo, o formulário é novo e o aviso da tentativa anterior sai
-const entradaInvalida = erro instanceof ApiError && erro.codigo === ErrorCode.ENTRADA_INVALIDA
+const entradaInvalida = erro instanceof ApiError && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o formulário vazio: o erro de cada campo, o foco no primeiro, e nenhum pedido
-const erros = tentou ? errosDoRascunhoDaLicenca(rascunho) : {}
+const erros = errosDoRascunhoDaLicenca(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o formulário vazio: o erro de cada campo, o foco no primeiro, e nenhum pedido
-if (primeiro !== undefined) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha com o diálogo aberto: o aviso no alerta; ao fechar e abrir de novo, o formulário é novo e o aviso da tentativa anterior sai
-falha={erro === undefined || erro === null || entradaInvalida ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
+falha={false || erro === null || entradaInvalida ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido
-falha={erro === undefined || erro === null || entradaInvalida ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
+falha={erro === undefined || erro === null ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido
-falha={erro === undefined || erro === null || entradaInvalida ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
+falha={erro === undefined || erro === null || false ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido
-<CamposDaVigencia rascunho={rascunho} aoMudar={mudar} erros={erros} erroDoFim={erros.vigenteAte ?? (entradaInvalida ? TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA : undefined)} />
+<CamposDaVigencia rascunho={rascunho} aoMudar={mudar} erros={erros} erroDoFim={erros.vigenteAte} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › ENTRADA_INVALIDA da API: o erro no campo do fim, com o diálogo aberto e o que foi escrito mantido
-<CamposDaVigencia rascunho={rascunho} aoMudar={mudar} erros={erros} erroDoFim={erros.vigenteAte ?? (entradaInvalida ? TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA : undefined)} />
+<CamposDaVigencia rascunho={rascunho} aoMudar={mudar} erros={erros} erroDoFim={erros.vigenteAte ?? TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a licença sem fim abre com o fim vazio, e salvar sem mexer manda o fim nulo
-const [rascunho, definirRascunho] = useState<RascunhoDaVigencia>({ vigenteDesde: licenca.vigenteDesde, vigenteAte: licenca.vigenteAte ?? '' })
+const [rascunho, definirRascunho] = useState<RascunhoDaVigencia>({ vigenteDesde: licenca.vigenteDesde, vigenteAte: licenca.vigenteAte ?? '2099-12-31' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a licença que saiu da lista
-if (listChanged(erro, [ErrorCode.NAO_ENCONTRADO])) void recarregar()
+if (false) void recarregar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o fim antes do começo: o erro no campo do fim, sem PATCH, e o texto do efeito some
-const erros = tentou ? errosDaVigencia(rascunho) : {}
+const erros = errosDaVigencia(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o fim antes do começo: o erro no campo do fim, sem PATCH, e o texto do efeito some
-const efeito = nova === undefined ? undefined : textoDoEfeitoDaVigencia(efeitoDaVigencia(licenca, nova, hoje))
+const efeito = nova === undefined ? 'sem efeito' : textoDoEfeitoDaVigencia(efeitoDaVigencia(licenca, nova, hoje))
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha que não é a da licença fora da lista: o aviso no alerta, e "Salvar vigência" continua para tentar de novo
-const mudou = mutacao.isError && listChanged(mutacao.error, [ErrorCode.NAO_ENCONTRADO])
+const mudou = mutacao.isError
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a licença que saiu da lista
-falha={mutacao.isError ? errorText(mutacao.error, TEXTOS_DA_FALHA_DA_VIGENCIA) : undefined}
+falha={undefined}
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › as criadas automaticamente são destacadas para revisão, e só elas; a faixa diz quantas
-{registradaAntesDaF4(licenca) && (
+{true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › as datas em dd/mm/aaaa, cada uma com o rótulo; sem fim, "Sem data de fim"
-<dd className="text-tinta">{licenca.vigenteAte === null ? 'Sem data de fim' : dataDaLicenca(licenca.vigenteAte)}</dd>
+<dd className="text-tinta">{licenca.vigenteAte === null ? 'Sem fim' : dataDaLicenca(licenca.vigenteAte)}</dd>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › as datas em dd/mm/aaaa, cada uma com o rótulo; sem fim, "Sem data de fim"
-<dd className="text-tinta">{licenca.vigenteAte === null ? 'Sem data de fim' : dataDaLicenca(licenca.vigenteAte)}</dd>
+<dd className="text-tinta">{licenca.vigenteAte !== null ? 'Sem data de fim' : dataDaLicenca(licenca.vigenteAte)}</dd>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a resposta atrasada não fecha o diálogo de outra abertura: o que a pessoa já digitou nele fica
-if (!emRegistro) reiniciarORegistro()
+reiniciarORegistro()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha que chega com o diálogo já fechado aparece na tela, e some ao abrir de novo
-const doRegistroQueFalhou = registro.isError && aberta?.tipo !== 'registrar'
+const doRegistroQueFalhou = aberta?.tipo !== 'registrar'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha com o diálogo aberto: o aviso no alerta; ao fechar e abrir de novo, o formulário é novo e o aviso da tentativa anterior sai
-const doRegistroQueFalhou = registro.isError && aberta?.tipo !== 'registrar'
+const doRegistroQueFalhou = registro.isError
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha que chega com o diálogo já fechado aparece na tela, e some ao abrir de novo
-{doRegistroQueFalhou && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › carregando: a leitura no ar, sem tabela, sem botão e sem dizer que está vazio
-return licencas.isPending ? (
+return false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › erro: a mensagem curta e "Tentar de novo", que lê a lista de novo; a falha não afirma o vazio
-) : lista === undefined ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › vazio: "Nenhuma licença registrada", com "Registrar licença" como único botão, e nenhuma tabela
-) : lista.itens.length === 0 ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o diálogo fechado com o pedido no ar: o botão da tela fica desligado, não sai um segundo POST, e a resposta atrasada só anuncia
-{emRegistro ? 'Registrando…' : 'Registrar licença'}
+{'Registrar licença'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o diálogo fechado com o pedido no ar: o botão da tela fica desligado, não sai um segundo POST, e a resposta atrasada só anuncia
-<Button onClick={aoRegistrar} disabled={emRegistro}>
+<Button onClick={aoRegistrar}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › sem nenhuma licença criada automaticamente, sem a faixa
-{antesDaF4 > 0 && (
+{true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o formulário vazio: o erro de cada campo, o foco no primeiro, e nenhum pedido
-corpo.current?.querySelector<HTMLInputElement>(`[data-campo="${primeiro}"] input`)?.focus()
+corpo.current?.querySelector<HTMLInputElement>(`[data-campo="${primeiro}"] input`)?.blur()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o formulário vazio: o erro de cada campo, o foco no primeiro, e nenhum pedido
-const primeiro = CAMPOS_DA_LICENCA.find((nome) => comErro[nome] !== undefined)
+const primeiro = CAMPOS_DA_LICENCA.find((nome) => comErro[nome] === undefined)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › as criadas automaticamente são destacadas para revisão, e só elas; a faixa diz quantas
-<Alert tom="atencao" titulo={antesDaF4 === 1 ? 'Uma licença foi criada a partir do nome da editora de cada material' : `${String(antesDaF4)} licenças foram criadas a partir do nome da editora de cada material`}>
+<Alert tom="atencao" titulo={antesDaF4 === 1 ? 'Licenças criadas automaticamente' : `${String(antesDaF4)} licenças foram criadas a partir do nome da editora de cada material`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › duas ou mais licenças criadas automaticamente: a faixa diz quantas, no plural
-<Alert tom="atencao" titulo={antesDaF4 === 1 ? 'Uma licença foi criada a partir do nome da editora de cada material' : `${String(antesDaF4)} licenças foram criadas a partir do nome da editora de cada material`}>
+<Alert tom="atencao" titulo={antesDaF4 === 1 ? 'Uma licença foi criada a partir do nome da editora de cada material' : `${String(antesDaF4)} licenças`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a releitura que falha com a lista já na tela: a lista fica, a falha é dita e "Tentar de novo" lê de novo
-{licencas.isError && <FalhaDaReleitura licencas={licencas} />}
+{false && <FalhaDaReleitura licencas={licencas} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a releitura que falha com a lista já na tela: a lista fica, a falha é dita e "Tentar de novo" lê de novo
-{licencas.isError && <FalhaDaReleitura licencas={licencas} />}
+{true && <FalhaDaReleitura licencas={licencas} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a releitura que falha com a lista já na tela: a lista fica, a falha é dita e "Tentar de novo" lê de novo
-{licencas.isFetching ? 'Tentando de novo…' : ''}
+{''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o caminho feliz: um POST com o que foi escrito
-{aberta?.tipo === 'registrar' && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita
-{aberta?.tipo === 'vigencia' && aberta.alvo !== undefined && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita
-{aberta?.tipo === 'vigencia' && aberta.alvo !== undefined && (
+{aberta?.tipo === 'registrar' && aberta.alvo !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a falha com o diálogo aberto: o aviso no alerta; ao fechar e abrir de novo, o formulário é novo e o aviso da tentativa anterior sai
-erro={erroDoRegistro ?? undefined}
+erro={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o caminho feliz: um POST com o que foi escrito
-return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'POST', corpo: pedido })
+return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'PUT', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o caminho feliz: um POST com o que foi escrito
-return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'POST', corpo: pedido })
+return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'POST' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita
-return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'PATCH', corpo: pedido })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'POST', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita
-return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'PATCH', corpo: pedido })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'PATCH' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › mostra quantos materiais saem da busca antes de confirmar, e só então manda o PATCH, uma vez, com a vigência escrita
-return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}`, licencaResponseSchema, { metodo: 'PATCH', corpo: pedido })
+return authedRequest(CAMINHO, licencaResponseSchema, { metodo: 'PATCH', corpo: pedido })
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/licencas.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › erro: a mensagem curta e "Tentar de novo", que lê a lista de novo; a falha não afirma o vazio
-queryFn: ({ signal }) => lerPaginas<Licenca>(CAMINHO, listaDeLicencasResponseSchema, signal),
+queryFn: ({ signal }) => lerPaginas<Licenca>('/v1/materiais', listaDeLicencasResponseSchema, signal),
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › a 30 dias do fim: avisa, com o dia e o mês do fim
-return `${COORDENACAO_ROUTES.material}?${ABA_DO_MATERIAL_PARAM}=licencas`
+return `${COORDENACAO_ROUTES.material}?${ABA_DO_MATERIAL_PARAM}=materiais`
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › aba=licencas abre a aba Licenças, selecionada; sem o parâmetro abre Materiais
-export const ABA_DO_MATERIAL_PARAM = 'aba'
+export const ABA_DO_MATERIAL_PARAM = 'sala'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vigente: o texto e a família que a tela mostra
-case 'vigente':
+case 'vigente_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vence_em_30_dias: o texto e a família que a tela mostra
-case 'vence_em_30_dias':
+case 'vence_em_30_dias_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › vencida: o texto e a família que a tela mostra
-case 'vencida':
+case 'vencida_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › futura: o texto e a família que a tela mostra
-case 'futura':
+case 'futura_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-case 'saem':
+case 'saem_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-case 'voltam':
+case 'voltam_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/licencas.ts
teste: apps/web/src/areas/coordenacao/material/licencas.test.ts › o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado
-case 'nenhum':
+case 'nenhum_x' as never:
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o primeiro registro, do vazio: o botão que abriu o diálogo sai da tela com o vazio, e o foco vai ao título da lista
-const focarNaLista = useCallback(() => (tituloDaLista.current === null ? focarOTituloDaMoldura() : tituloDaLista.current.focus()), [focarOTituloDaMoldura])
+const focarNaLista = useCallback(() => (tituloDaLista.current === null ? focarOTituloDaMoldura() : undefined), [focarOTituloDaMoldura])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a releitura que cai com a lista ainda vazia não afirma o vazio: o registro que falhou, com a leitura seguinte também falhando, mostra o erro e "Tentar de novo"
-licencas.isError ? (
+false ? (
```

```mutacao
arquivo: apps/web/src/components/ui/ListItem.tsx
teste: apps/web/src/components/ui/ListItem.test.tsx › o título que pede `tituloInteiro` quebra em quantas linhas precisar: sem reticências e sem o corte de duas linhas, mesmo com `tituloEmDuasLinhas`
-if (inteiro) return 'break-words'
+if (false) return 'break-words'
```

```mutacao
arquivo: apps/web/src/components/ui/ListItem.tsx
teste: apps/web/src/components/ui/ListItem.test.tsx › o título que pede `tituloEmDuasLinhas` quebra em até duas linhas, sem reticência de uma só
-return emDuasLinhas ? 'line-clamp-2 break-words' : 'truncate'
+return 'truncate'
```

```mutacao
arquivo: apps/web/src/components/ui/ListItem.tsx
teste: apps/web/src/components/ui/ListItem.test.tsx › o título que pede `tituloEmDuasLinhas` quebra em até duas linhas, sem reticência de uma só
-return emDuasLinhas ? 'line-clamp-2 break-words' : 'truncate'
+return emDuasLinhas ? 'break-words' : 'truncate'
```

```mutacao
arquivo: apps/web/src/components/sino/Sino.tsx
teste: apps/web/src/components/sino/Sino.test.tsx › o item que pede `tituloInteiro` mostra o título sem reticências; o que não pede segue numa linha só
-{...(item.tituloInteiro === true ? { tituloInteiro: true } : {})}
+{...(item.tituloInteiro === false ? { tituloInteiro: true } : {})}
```

```mutacao
arquivo: apps/web/src/components/sino/Sino.tsx
teste: apps/web/src/components/sino/Sino.test.tsx › o item que pede `tituloInteiro` mostra o título sem reticências; o que não pede segue numa linha só
-{...(item.tituloInteiro === true ? { tituloInteiro: true } : {})}
+{...(true ? { tituloInteiro: true } : {})}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um item por licença, com ids distintos, e o texto não leva licenciante nem número
 detalhe: 'Atualize a vigência antes do fim, ou os materiais dela saem da busca.',
 urgente: false,
-tituloInteiro: true,
+tituloInteiro: false,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts › um item por licença, com ids distintos, e o texto não leva licenciante nem número
 detalhe: 'Atualize a vigência para eles voltarem.',
 urgente: false,
-tituloInteiro: true,
+tituloInteiro: false,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a licença criada automaticamente diz "Documento: não informado", e a tela não mostra o nome de fase nem de migração
-<span className="text-sm break-words text-apoio">Documento: {registradaAntesDaF4(licenca) ? 'não informado' : licenca.referencia}</span>
+<span className="text-sm break-words text-apoio">Documento: {licenca.referencia}</span>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › as criadas automaticamente são destacadas para revisão, e só elas; a faixa diz quantas
-<StatusBadge familia="pendente">Criada automaticamente · revise</StatusBadge>
+<StatusBadge familia="pendente">Registrada antes da F4 · revise</StatusBadge>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › os tipos da fila do Painel são os seis do sino: nenhum item de uso, de entrega ou de atividade
-{...(item.tituloInteiro === true ? { tituloInteiro: true } : {})}
+{...(item.tituloInteiro === false ? { tituloInteiro: true } : {})}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › os tipos da fila do Painel são os seis do sino: nenhum item de uso, de entrega ou de atividade
-{...(item.tituloInteiro === true ? { tituloInteiro: true } : {})}
+{...(true ? { tituloInteiro: true } : {})}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a troca de sessão apaga o anúncio do registro da pessoa anterior
 fecharDialogo()
-definirAnuncio('')
+
 reiniciarORegistro()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › a troca de sessão apaga a falha do registro da pessoa anterior, que chegou com o diálogo fechado
 definirAnuncio('')
-reiniciarORegistro()
+
      }),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o vazio com o pedido no ar: o botão do vazio fica desligado e diz que verifica
-acao={{ rotulo: 'Registrar licença', aoAcionar: aoRegistrar, desligada: emRegistro, emAndamento: emRegistro }}
+acao={{ rotulo: 'Registrar licença', aoAcionar: aoRegistrar, emAndamento: emRegistro }}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Licencas.tsx
teste: apps/web/src/areas/coordenacao/material/Licencas.test.tsx › o vazio com o pedido no ar: o botão do vazio fica desligado e diz que verifica
-acao={{ rotulo: 'Registrar licença', aoAcionar: aoRegistrar, desligada: emRegistro, emAndamento: emRegistro }}
+acao={{ rotulo: 'Registrar licença', aoAcionar: aoRegistrar, desligada: emRegistro }}
```

## Recomendações sem aplicar

- `POST /v1/licencas` sem chave de idempotência (API, 5.0): a tela segura um pedido por vez e, com a resposta perdida, manda conferir a lista; uma chave `Idempotency-Key` na rota tiraria a dúvida. Fora desta tarefa (só web).

Da rodada 1 (`.processo/ordens/6_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | O rótulo de leitor de tela "da licença de {licenciante}" (`Licencas.tsx`): se o componente for usado fora da coordenação, trocar pelo texto da cobertura | Nada a fazer hoje: só a coordenação vê a aba. Fica como aviso para quem reusar o componente |
| privacy-guardian (1ª) | `registradaAntesDaF4` compara o texto da referência; um marcador próprio na API seria mais firme | `TODO.md`: muda o contrato da API (5.0), não cabe numa tarefa de web |
| conformidade-reviewer (1ª) | A frase "O que já foi gerado continua citando a página" (`licencas.ts`): conferir na 7.0 que a promessa segue verdadeira e registrar no teste da 7.0 | Tarefa 7.0, que liga a licença ao envio |
| conformidade-reviewer (1ª) | A vitrine cheia ter ao menos uma licença em cada situação e o sino com os dois avisos, como pede a seção "Telas" (`6_task.md:69`) | `TODO.md`, para antes da validação da spec: o Validador fotografa cada requisito com tela, e hoje a vitrine (`tools/vitrine/`) não tem licença |
| infra-guardian (1ª) e test-engineer (1ª) | `POST /v1/licencas` sem chave de idempotência (`Idempotency-Key` ou restrição única no banco; D49, regra 80 item 7) | `TODO.md` e retro: é a API da 5.0; a tela já relê a lista quando o registro falha |
| infra-guardian (1ª) | A aba usa o padrão global (`staleTime` de 30 s e releitura ao voltar o foco); decidir de forma explícita se fica igual ao sino | Não aplicada: muda o comportamento da aba, e a carga é pequena, só a coordenação a usa (nas palavras do revisor) |
| infra-guardian (1ª) | O sino faz uma sétima leitura por sessão; se crescer, um endpoint agregado da fila | `TODO.md`: não pesa às 10h, e é desenho de API |
| revisor-geral (1ª) | Fixar `locale: 'pt-BR'` na vitrine e no e2e, para a foto mostrar a data como a coordenadora a vê | `TODO.md`: é da ferramenta (`tools/vitrine/`, configuração do Playwright), não da tela |
| frontend-reviewer (1ª) | A sub-aba "Materiais \| Licenças" se parece com a barra de abas de Escola; se confundir, diferenciar o estilo | Validação: o Validador vê a tela com licenças; `TODO.md` se a coordenação confundir os dois níveis |
| test-engineer (1ª) | Datas do e2e perto da meia-noite de São Paulo (`diaEm` do Node contra `now()` do Postgres); o "Como testar" previa `page.clock` e "num sábado também", e o e2e não usa nenhum dos dois | Validação e `TODO.md`. Fato para quem alinhar: `6_task.md:66` e `:74` ainda dizem `page.clock` |
| frontend-reviewer (1ª), revisor-geral (1ª) | `sino` e `tituloInteiro` bem feitos; a prop e o `?aba=licencas` não contrariam a Tech Spec §9 | Nada a fazer: são aprovações |

Da rodada 2 (`.processo/ordens/6_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (2ª) | No singular, "Uma licença foi criada a partir do nome da editora de cada material" soa estranho ("de cada material" supõe várias); algo como "Uma licença foi criada automaticamente, a partir do nome da editora" | Não aplicada: só texto, e mudar de novo põe a tela, os testes, o e2e e `docs/interface.md` em outra rodada. `TODO.md` |
| frontend-reviewer (2ª), revisor-geral (2ª), conformidade-reviewer (2ª) | Os nomes `registradaAntesDaF4` e `antesDaF4` e os comentários de `Licencas.tsx` (l.106 e l.222) ainda dizem "F4" e "faixa da migração"; um nome como `criadaAutomaticamente` ficaria igual ao da tela | Retro ou X8 (nomes de mercado): é só nome de código, a tela já não mostra a fase |
| test-engineer (2ª) | Na linha "registradas antes da F4" da tabela de `6_task.md`, citar o caso pelo nome real: "sem nenhuma licença criada automaticamente, sem a faixa" | Aplicada ao copiar a tabela: a linha da tabela já cita os três casos pelo nome real |
| test-engineer (2ª) | A dica "Por exemplo: Termo 2026/07." do campo do documento (`DialogoDeLicenca.tsx`) não tem asserção | Não aplicada: texto sem condição, não bloqueia |
| infra-guardian (2ª) | O e2e (`material-licencas.spec.ts`, caso do registro com resposta lenta) não prova mais o segundo clique; quando o `POST /v1/licencas` ganhar idempotência, voltar a provar que o servidor grava uma licença só | Mesmo destino da idempotência: `TODO.md` e retro. O clique duplo segue provado pelo caso de unidade "clique duplo em registrar: um POST só" |
| infra-guardian (2ª) | O `TODO.md` ainda não tem a `Idempotency-Key` do `POST /v1/licencas` nem o endpoint agregado do sino, que a ordem da rodada 1 mandou para lá | Lançadas no `TODO.md` neste commit, com as outras da tabela da rodada 1 que foram para ele |
| conformidade-reviewer (2ª) | Conferir na validação que nenhum caso novo amarre a contagem de leituras do Painel só a "onze" (`Painel.test.tsx`, `LEITURAS_DO_PAINEL`) | Validação |
| revisor-geral (2ª) | Locale pt-BR na vitrine e no e2e (as fotos ainda mostram "mm/dd/yyyy") | Já em "Sem aplicar" da rodada 1: `TODO.md` |
| frontend-reviewer (2ª) | Sub-aba Materiais/Licenças parecida com a barra de Escola | Já em "Sem aplicar" da rodada 1: Validação e `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 00:59:38 | 2026-11-13 01:00:24 | `privacy-guardian` | 1 | APROVADO | a4c8fccc4579731f2 |
| 2026-11-13 01:00:03 | 2026-11-13 01:00:30 | `tenancy-guardian` | 1 | APROVADO | a0e4fa69d0d2183ba |
| 2026-11-13 00:59:44 | 2026-11-13 01:00:32 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | acbfedb0c9e70a4e4 |
| 2026-11-13 01:00:07 | 2026-11-13 01:00:46 | `conformidade-reviewer` | 1 | APROVADO | ab08de9f643069ac7 |
| 2026-11-13 01:00:13 | 2026-11-13 01:00:57 | `infra-guardian` | 1 | APROVADO | aa156e80b5c623d51 |
| 2026-11-13 00:59:57 | 2026-11-13 01:01:34 | `revisor-geral` | 1 | APROVADO | a1e9f69265e1c46f2 |
| 2026-11-13 00:59:51 | 2026-11-13 01:02:01 | `test-engineer` | 1 | REPROVADO | adb966681c8b312ad |
| 2026-11-13 01:22:39 | 2026-11-13 01:23:05 | `privacy-guardian` | 2 | APROVADO | a9e515f4d5fb86fa4 |
| 2026-11-13 01:22:50 | 2026-11-13 01:23:13 | `frontend-reviewer` | 2 | APROVADO | ad789d819643d3e32 |
| 2026-11-13 01:23:23 | 2026-11-13 01:23:40 | `tenancy-guardian` | 2 | APROVADO | af9b3175ed966b480 |
| 2026-11-13 01:23:15 | 2026-11-13 01:23:42 | `revisor-geral` | 2 | APROVADO | a6afef571d7b84563 |
| 2026-11-13 01:23:34 | 2026-11-13 01:23:52 | `conformidade-reviewer` | 2 | APROVADO | a7392ea1f2474603c |
| 2026-11-13 01:23:03 | 2026-11-13 01:23:57 | `test-engineer` | 2 | APROVADO | a3c92e079e34d9d89 |
| 2026-11-13 01:23:43 | 2026-11-13 01:24:03 | `infra-guardian` | 2 | APROVADO | ab320795b6b2d7a81 |
