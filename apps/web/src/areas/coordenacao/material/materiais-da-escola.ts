import type { EstadoDeMaterial, LicencaDeclarada, Material, MotivoDaRecusaDoMaterial } from '@educa/shared'
import { PARAMETRO_DO_MATERIAL } from '../../../paths'
import type { FamiliaDeEstado } from '../../../components/ui/SeloDeEstado'
import { doMaisNovoAoMaisAntigo, OPCOES_DE_LICENCA, textoDoEstado, type RascunhoDoEnvio } from './material-envio'

/**
 * O que a aba Material desenha, sem React (telas da coordenação, 8.0; Tech Spec seção 9, "Material"): as linhas da tabela, na ordem
 * em que a coordenação precisa delas, o texto e a família da situação de cada uma, e o material que o endereço abre. Fica num
 * módulo puro para a ordem e a busca pelo id terem teste de unidade e para a tela só desenhar.
 */

/** Um envio recusado por licença: existe só na tela, porque a recusa não vira material (D5). Fica na tabela até a pessoa dispensá-la. */
export interface RecusaDeEnvio {
  readonly chave: number
  readonly titulo: string
  readonly disciplinaId: string
  readonly licenca: LicencaDeclarada
  readonly motivo: MotivoDaRecusaDoMaterial
}

/** Uma linha da tabela: o material da escola, ou o envio que foi recusado e ainda está à vista. */
export type LinhaDoMaterial = { readonly tipo: 'material'; readonly material: Material } | { readonly tipo: 'recusa'; readonly recusa: RecusaDeEnvio }

/** A família do selo de cada situação: o que está sendo lido espera, o pronto está certo e o que falhou é erro. */
export const FAMILIA_DA_SITUACAO_DO_MATERIAL = { processando: 'pendente', pronto: 'ok', falhou: 'erro' } as const satisfies Readonly<Record<EstadoDeMaterial, FamiliaDeEstado>>

/** O que o selo diz do material: "Não carregou", "Processando" ou "Pronto · N páginas". */
export function textoDaSituacaoDoMaterial(material: Pick<Material, 'estado' | 'paginas'>): string {
  return material.estado === 'falhou' ? 'Não carregou' : textoDoEstado(material)
}

/** O nome da licença na coluna "Licença", do material e do envio recusado: uma tradução só, a das opções do formulário. */
export function nomeDaLicenca(licenca: LicencaDeclarada): string {
  return OPCOES_DE_LICENCA.find((opcao) => opcao.valor === licenca)?.rotulo ?? '—'
}

/** O que o selo diz do envio recusado: o motivo vai junto, curto, e o texto inteiro mora ao lado dele. */
export function textoDaSituacaoDaRecusa(recusa: Pick<RecusaDeEnvio, 'motivo'>): string {
  return recusa.motivo === 'sem_licenca' ? 'Envio recusado · sem licença' : 'Envio recusado · sem declaração'
}

/**
 * As linhas da tabela: **o que falhou vem primeiro** — os envios recusados e, depois deles, os materiais que não carregaram — e em
 * seguida o resto; dentro de cada grupo, o mais novo antes. As recusas já chegam da mais nova para a mais antiga (a tela põe a
 * nova na frente), e os materiais chegam na ordem de envio da API.
 */
export function linhasDosMateriais(itens: readonly Material[], recusas: readonly RecusaDeEnvio[]): LinhaDoMaterial[] {
  const maisNovosPrimeiro = doMaisNovoAoMaisAntigo(itens)
  return [
    ...recusas.map((recusa): LinhaDoMaterial => ({ tipo: 'recusa', recusa })),
    ...maisNovosPrimeiro.filter((material) => material.estado === 'falhou').map((material): LinhaDoMaterial => ({ tipo: 'material', material })),
    ...maisNovosPrimeiro.filter((material) => material.estado !== 'falhou').map((material): LinhaDoMaterial => ({ tipo: 'material', material })),
  ]
}

/** O material que o endereço abre, achado só na lista que a escola já carregou: o id que ela não tem não abre nada (regra 10, item 6). */
export function materialDoEndereco(busca: string, materiais: readonly Material[]): Material | undefined {
  const id = new URLSearchParams(busca).get(PARAMETRO_DO_MATERIAL)
  return materiais.find((material) => material.id === id)
}

/**
 * O formulário que o "Tentar de novo" de um material que falhou abre: o que ele declarava — título, disciplina, de quem é, quem deu a
 * licença e a licença —, sem o arquivo e **sem a declaração marcada**: quem declara é a pessoa que envia de novo, a cada envio.
 */
export function rascunhoDoMaterialQueFalhou(material: Pick<Material, 'titulo' | 'disciplinaId' | 'titularidade' | 'licenciante' | 'licenca'>): RascunhoDoEnvio {
  return {
    titulo: material.titulo,
    disciplinaId: material.disciplinaId,
    titularidade: material.titularidade,
    licenciante: material.licenciante ?? '',
    licenca: material.licenca,
    declaracao: false,
    temArquivo: false,
  }
}
