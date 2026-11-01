# Inventário — adenda 5 (X8)

Anexo do `inventario.md`. **Status:** aprovada pelo Joaquim em 01/11/2026 (opção A), no terminal do Orquestrador (RF2).
Proposta pelo Arquiteto no mesmo dia, na triagem da divergência da 12.0 (`.processo/divergencia-12-arvore.md` da L1).

**De onde vem.** A guarda do RF8, ligada na árvore da 12.0 (sem commit), acusa 11 declarações de topo depois das ondas
3.0 a 11.0. Todas seguem uma regra que o §1 do inventário já aprovou, e escaparam pelo mesmo motivo: o script da adenda 2
tirou da lista o que os anexos já citavam **pelo nome**, e não pelo caminho. Um homônimo em outro arquivo (o
`SeguroEmMemoria` do core ao lado do da API, o `LinhaDoResumo` do kit ao lado do de `meus-dados`) saiu junto, e as ondas
o deixaram como `fica`.

**Como o nome novo foi dado.** A regra do §1, como na adenda 2. Três linhas fogem do nome mecânico, porque o mecânico
colidiria no mesmo pacote (o `aplicar` recusa, como recusou os dois `Tema` da 10.0) ou trocaria o sentido:

- `LinhaDoResumo` do kit: `ResumoRow` já é o de `components/meus-dados/regras.ts`, na mesma `apps/web`. O nome segue o
  do componente, como `ConfirmDialogProps`;
- `Cartao` de `ChoicePrompt.test.tsx`: é o invólucro com estado do teste, não o cartão do kit, e `Card` já é o do kit;
- `SeguroEmMemoria` do core: o "seguro" é o limitador em memória que entra quando o Redis não responde (o da API, que
  virou `InMemoryLockout`, é outra peça);
- `esquemaAmbienteMigrar`: `Ambiente` vira `Env` (adenda 2), como o `operadorEnvSchema` ao lado em `ops/`.

| Nome atual | Nome novo | Tipo | Caminho |
|---|---|---|---|
| `LinhaDoResumo` | `ConfirmDialogRow` | interface (exportada; usada em `areas/professor/atividades/aprovar.ts`) | `apps/web/src/components/ui/overlays/ConfirmDialog.tsx` |
| `LinhaDoMaterial` | `MaterialRow` | tipo | `apps/web/src/areas/coordenacao/material/materiais-da-escola.ts` |
| `Cartao` | `StatefulChoicePrompt` | função (componente local do teste) | `apps/web/src/components/ui/ai/ChoicePrompt.test.tsx` |
| `LinhaDaSessao` | `SessaoRow` | interface | `apps/api/test/sessao-operador.int.test.ts` |
| `OpcoesDeToken` | `TokenOptions` | interface | `packages/core/src/identidade/verify-token.test.ts` |
| `SeguroEmMemoria` | `InMemoryFallback` | classe | `packages/core/src/rate-limit/rate-limiter.ts` |
| `esquemaNome` | `nomeSchema` | const (zod; exportada, usada em `ops/escola.ts`, `ops/operador.ts`, `ops/convite-coordenador.ts`) | `apps/api/src/ops/command.ts` |
| `esquemaAmbienteMigrar` | `migrarEnvSchema` | const (zod) | `apps/api/src/ops/migrar.ts` |
| `esquemaPedido` | `pedidoSchema` | const (zod) | `apps/api/src/ops/redefinir-mfa.ts` |
| `esquemaId` | `idSchema` | const (zod) | `packages/core/src/pipes/id.pipe.ts` |
| `esquemaContagem` | `contagemSchema` | const (zod) | `packages/shared/src/operacao/painel.ts` |

**Onde entra.** Numa correção (`corrigir`), antes de a 12.0 retomar, com um mapa próprio em `tools/renomear/mapas/`,
`linhaDoAnexo` de cada entrada apontando para a linha dela nesta tabela (`inventario-adenda-5.md:24` a `:34`, na
ordem da tabela), e o mesmo `aplicar`, `conferir` e `restos` das ondas. A 12.0 não muda: a guarda continua sem exceção
nova, e a árvore passa porque os 11 deixaram de existir.

**Se for recusada,** os 11 entram como exceção nominal em `nomes-de-mercado.mjs`, cada um com o motivo, e o critério
"a árvore inteira passa" do RF8 passa a valer "com as exceções nominais"; a X8 termina com esses 11 nomes em português.
