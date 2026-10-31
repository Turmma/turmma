import { enviarMaterialRequestSchema, MAXIMO_DE_BYTES_DO_MATERIAL, motivoDaRecusaDoMaterial } from '@educa/shared'
import { Injectable, type CanActivate } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MaterialService } from './material.service.js'

/** O nome do campo do arquivo no multipart de `POST /v1/materiais`. */
export const CAMPO_DO_ARQUIVO = 'arquivo'
/** Os campos de texto do pedido são seis; a folga é para o pedido com campo a mais chegar ao contrato e sair `ENTRADA_INVALIDA`. */
const MAXIMO_DE_CAMPOS = 10
/** O maior campo de texto é o título, de 160 caracteres. */
const MAXIMO_DE_BYTES_POR_CAMPO = 2 * 1024

/**
 * O pedido, pelos campos que já chegaram, **será recusado por licença**? Se sim, o arquivo nem é recebido: os bytes
 * dele são descartados conforme chegam, sem ir para a memória. Só vale quando os campos vêm antes do arquivo, que é
 * como a nossa tela manda; se o arquivo vier antes, ou se os campos não passarem no contrato, o arquivo é recebido e
 * quem decide é o serviço, na mesma ordem (disciplina, licença, e só então o arquivo).
 */
export function seraRecusadoPorLicenca(campos: unknown): boolean {
  const pedido = enviarMaterialRequestSchema.safeParse(campos)
  return pedido.success && motivoDaRecusaDoMaterial(pedido.data) !== null
}

/**
 * O recebimento do multipart (regra 80, item 3): **um** arquivo, no campo `arquivo`, com o tamanho limitado enquanto
 * chega — passou de `MAXIMO_DE_BYTES_DO_MATERIAL`, o recebimento para ali e a resposta é 413 `ENTRADA_INVALIDA`; o
 * arquivo nunca é carregado inteiro para depois ser medido. Vai para a memória, e não para disco nem para o storage: o
 * arquivo não é guardado (`docs/mvp-rapido.md`, seção 4, item 3). O nome do arquivo e o tipo que o navegador declara
 * não são usados em regra nenhuma: PDF é o que tem a assinatura de PDF no conteúdo.
 */
export const MaterialUploadInterceptor = FileInterceptor(CAMPO_DO_ARQUIVO, {
  limits: { fileSize: MAXIMO_DE_BYTES_DO_MATERIAL, files: 1, fields: MAXIMO_DE_CAMPOS, fieldSize: MAXIMO_DE_BYTES_POR_CAMPO, parts: MAXIMO_DE_CAMPOS + 1 },
  fileFilter: (requisicao: { body?: unknown }, _arquivo, decidir) => {
    decidir(null, !seraRecusadoPorLicenca(requisicao.body))
  },
})

/**
 * Os tetos de envio conferidos **antes** de o corpo ser lido: guarda de rota roda depois das guardas globais (a sessão
 * e a permissão já estão no contexto) e antes do interceptor que recebe o arquivo. Acima do teto, `LIMITE_EXCEDIDO`
 * com `Retry-After`, sem receber nada.
 */
@Injectable()
export class MaterialUploadGuard implements CanActivate {
  constructor(private readonly materiais: MaterialService) {}

  async canActivate(): Promise<boolean> {
    await this.materiais.exigirEnvioDentroDosTetos()
    return true
  }
}
