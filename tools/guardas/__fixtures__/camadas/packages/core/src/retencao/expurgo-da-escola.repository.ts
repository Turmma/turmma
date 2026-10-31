import { CicloDeVidaService } from '../ciclo-de-vida/ciclo-de-vida.service.js'
export class ExpurgoDaEscolaRepository { constructor(readonly ciclo = new CicloDeVidaService()) {} }
