/**
 * Quantos arquivos de teste de unidade rodam ao mesmo tempo: a metade dos núcleos, e nunca menos de um. O Vitest usa um por núcleo menos um,
 * e parte da unidade sobe build, lint e processo de verdade, cada um com vários núcleos: com 11 trabalhadores em 12 núcleos a carga chegou
 * a 40 e os casos de uns 3 s passavam dos 5 s do padrão. Com 6 a unidade inteira passou, e mais depressa.
 *
 * Na esteira (2 núcleos) dá 1, o mesmo que o padrão do Vitest já dava lá: o limite não a torna mais lenta.
 */
export function limiteDeTrabalhadores(nucleos: number): number {
  return Math.max(1, Math.floor(nucleos / 2))
}
