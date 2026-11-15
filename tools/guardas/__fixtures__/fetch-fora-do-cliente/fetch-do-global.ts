// Fixture da guarda do `fetch` (52.0; RF11): o `fetch` lido do objeto global, que o `no-restricted-globals` não vê. Cada
// linha marcada é uma forma de chamá-lo sem passar pelo cliente da API.

export const doGlobalThis = () => globalThis.fetch('/v1/eu') /* reprova: no-restricted-syntax */
export const daJanela = () => window.fetch('/v1/eu') /* reprova: no-restricted-syntax */
export const daAba = () => self.fetch('/v1/eu') /* reprova: no-restricted-syntax */
export const comColchetes = () => window['fetch']('/v1/eu') /* reprova: no-restricted-syntax */
export const comCadeiaOpcional = () => window?.fetch('/v1/eu') /* reprova: no-restricted-syntax */
export const porAlias = () => {
  const janela = window
  return janela.fetch('/v1/eu') /* reprova: no-restricted-syntax */
}
