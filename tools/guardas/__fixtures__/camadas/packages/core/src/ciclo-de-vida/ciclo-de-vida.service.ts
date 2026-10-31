import { ContaGlobalRepository } from './conta-global.repository.js'
export class CicloDeVidaService { constructor(readonly conta = new ContaGlobalRepository()) {} }
