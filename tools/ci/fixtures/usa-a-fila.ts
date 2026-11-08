// Fixture do teste `tools/ci/fila-de-carga.test.ts`: um "portão" de brinquedo que entra na fila de carga, anota quando
// entrou e saiu num diário, e segura o lugar por alguns milissegundos. Com `--filho`, roda uma segunda cópia de si
// mesmo por dentro, como o portão faz com `npm run test:e2e`. Com `--espera-por=<outro>`, em vez de segurar o lugar por um
// tempo, só sai depois de ver `<outro> entrou` no diário: dois processos assim se sobrepõem por construção, qualquer que seja a
// ordem e o atraso com que chegam, e se a fila os separasse o primeiro esperaria em vão e sairia com 4.
//
//   node tools/ci/fixtures/usa-a-fila.ts <diário> <nome> <milissegundos> [--filho | --falha | --espera-por=<outro>]
//   (os milissegundos são ignorados em `--espera-por`: ali a saída espera o outro, e não o tempo; o teste passa `0`)
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { garantirFilaDeCarga } from '../fila-de-carga.ts'

await garantirFilaDeCarga()

const [diario, nome, milissegundos, modo] = process.argv.slice(2)
if (diario === undefined || nome === undefined || milissegundos === undefined) process.exit(2)

appendFileSync(diario, `${nome} entrou ${String(Date.now())}\n`)
if (modo === '--falha') process.exit(3)
if (modo === '--filho') {
  const resultado = spawnSync(process.execPath, [process.argv[1] ?? '', diario, `${nome}-filho`, milissegundos], { stdio: 'inherit' })
  if (resultado.status !== 0) process.exit(resultado.status ?? 1)
} else if (modo?.startsWith('--espera-por=') === true) {
  const outro = modo.slice('--espera-por='.length)
  // Vinte segundos de espera, contados em voltas do temporizador e não no relógio de parede, que nesta máquina recua: menos que os 30 s do caso
  // que usa isto, para a falha chegar como o código 4 e não como estouro de tempo. Cada linha do diário é `<nome> <evento> <hora>`; casa-se o começo
  // da linha, e não um trecho dela, para o nome de um não terminar no do outro e dar presença falsa.
  const viuOOutro = (): boolean => existsSync(diario) && readFileSync(diario, 'utf8').split('\n').some((linha) => linha.startsWith(`${outro} entrou `))
  for (let volta = 0; volta < 400 && !viuOOutro(); volta += 1) {
    await new Promise((resolver) => setTimeout(resolver, 50))
  }
  if (!viuOOutro()) process.exit(4)
} else {
  await new Promise((resolver) => setTimeout(resolver, Number(milissegundos)))
}
appendFileSync(diario, `${nome} saiu ${String(Date.now())}\n`)
