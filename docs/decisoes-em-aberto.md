# Decisões em aberto

> Movidas do `CLAUDE.md` (X7, RF20). O `tools/processo/estado.ts` conta as linhas da tabela no resumo da
> sessão. Decisão fechada sai daqui e entra em `docs/decisoes.md`, pelo `/registrar-decisao`.

Para fechar uma, peça ao Orquestrador (`/seguir`): o Arquiteto conduz a descoberta com você e
registra a decisão.

Todas têm dono e momento. Nenhuma trava o F0.

| Decisão | Dono | Quando fecha |
|---|---|---|
| **Projetos** do professor, **anexo de documento na conversa** e **faltas** por aluno: pedidos do Gabriel que não existem em nenhuma fase (P05, P07, P08). O anexo esbarra na D5 e abre a porta para correção de discursiva por IA (D55); faltas não tem origem de dado nem linha na tabela da LGPD | Gabriel e Joaquim | `descobrir` de cada um, antes de entrar em qualquer PRD; fora do MVP de apresentação até lá |
| Se o calendário junta as duas escolas do professor ou mostra só a escola ativa (P12, regra 10); o seletor de escola fechou na A1, só com a escola ativa e trocando o token (P30) | Joaquim e Gabriel | no PRD do F2, que absorveu o F8 |
| **Ranking de participação** (presença e entrega, com pódio), **Recursos** (enviar artefato à turma) e **Mural** da turma: pedidos do Gabriel que não existem em fase nenhuma. O ranking bate na proibição de placar e pódio do `docs/interface.md` 10.2 (D59) e chega perto de pontuação social (D57) (P26, P28) | Gabriel e Joaquim | `descobrir` de cada um; fora do MVP de apresentação até lá |
| As **oito ferramentas que a D67 não lista** — planejamento do período, projeto, plano de recuperação, mapa mental, roteiro de experimento, avaliação diagnóstica, proposta de redação e importar prova (P22). A regra e as categorias já estão na D74. O planejamento e o projeto dependem da grade e da semana do F2; o plano de recuperação, do F6 | Gabriel propõe; Joaquim decide e estima | por `descobrir`, uma a uma, antes do F7 |
| **Prova no papel (F6b, D83):** o prazo de retenção da imagem de conferência; se a leitura da foto roda no navegador do professor ou no servidor; e se a F6b vem antes ou depois da F9 no piloto | Joaquim | antes do PRD da F6b |
| **Provedor da VPS de produção** (região Brasil, snapshot e backup fora da VPS, borda; D82, D28, D62) | Joaquim | antes do PRD do F18 |
| Provedor de modelo principal e reserva | Joaquim | avaliação de `docs/avaliacao-de-modelos.md`, antes de a F5 ficar pronta (D37) |
| Registro no INPI e do domínio `turmma.com` (o nome já está fechado, D54) | Gabriel | antes do material de venda e do piloto |
| Se o art. 24 do ECA Digital exige conta de responsável vinculada para aluno de até 16 anos — e, se exigir, se o portal da família sai da fase posterior | Joaquim e Gabriel, com advogado | **antes do PRD do F9**; o vínculo já nasce no modelo de dados do F1 (`docs/regulacao.md` 2.2) |
| Como os arts. 17 e 18 do ECA Digital (supervisão parental) se modulam pelo art. 39 no nosso caso | advogado | junto com o parecer do ECA Digital |
| Evidência independente de eficácia pedagógica: desenho da medição com a escola piloto | Gabriel e Joaquim | ao fechar o piloto (`docs/conformidade-mec.md` 12) |
| Sistemas de ensino das escolas-alvo, licença do material e primeiro adaptador | quem conduzir o piloto | nas entrevistas com escolas; até lá só upload de material com licença (D5, D22) |
| Quais funcionalidades formam a fatia do piloto, e quais das quatro coisas da D24 ele precisa ter. Não confundir com o MVP de apresentação, que é sintético (D71) | Joaquim e Gabriel | com o MVP de apresentação de pé, antes de completar a primeira fase para escola real (D1 revista) |
| Valores das faixas de preço e teto de IA do pacote base | Gabriel e Joaquim | com a planilha de custo por pacote, validados no piloto (D50, D39) |
| Indicadores de desempenho do professor e do aluno (quais, limiar, texto do alerta). Ponto de partida: percentual de erro e acerto por habilidade e o sinal "concluiu o que foi atribuído"; tempo ocioso não entra (D69). O MVP mostra limiares provisórios (sinais do Tutor, destaques da correção, 60% do alerta do Analista), escolhidos na construção e listados no Estado de `docs/mvp-rapido.md`: entram nesta decisão | Joaquim e Gabriel | os de turma e aluno **antes do PRD do F6**, porque "Turmas" nasce lá (D69, D73); os de professor antes do PRD do F12 (D45, D46) |
| Imagens da ferramenta de apresentação: de onde vêm e com que licença (D67, D5) | Gabriel e Joaquim | antes do PRD do F7 |
| Lista padrão de fontes aprovadas da busca do Tutor, por faixa etária, e o provedor de busca (D68) | Gabriel (lista) e Joaquim (provedor) | antes do PRD do F9 |
| Se ligar a busca para aluno de até 16 anos sem conta de responsável vinculada conta como rebaixar a proteção (ECA Digital, art. 24, § 5º; D68) | advogado | junto com o parecer do ECA Digital, antes do PRD do F9 |
| Acompanhar a saída da aba fora de avaliação, com o aluno estudando em sala. Hoje não existe: bate na regra 70, item 7 (D70) | Joaquim e Gabriel, com advogado | na AIA de sinais; sem parecer, continua não existindo |
| Texto final das diretrizes do CNE e o que muda na correção, na devolutiva de discursiva e nos sinais do tutor | Joaquim, com advogado | quando a resolução for homologada e publicada pelo MEC (D46, D55) |
