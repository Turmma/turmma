import { CicloDeVidaService } from '../ciclo-de-vida/ciclo-de-vida.service.js'
export class OutroRepository { constructor(readonly ciclo = new CicloDeVidaService()) {} }
