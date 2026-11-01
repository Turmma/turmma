import { Aparencia } from '../../components/Aparencia'
import { TamanhoDaLetra } from '../../components/settings/TamanhoDaLetra'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/overlays/Dialog'

/**
 * "Ajustes" do aluno, em Eu (telas do aluno e primeiro acesso, 8.0; RF11; mockup 2.5): a `Aparencia` da X1 e o
 * `TamanhoDaLetra`. Os dois valem na hora e ficam só no navegador; abrir o diálogo não grava nada, e "Fechar" é a única saída
 * além do Esc (D59). O foco volta à linha "Ajustes" por qualquer caminho (`useModalDialog`).
 *
 * Fica de fora a "Senha": trocar a senha do aluno não existe nesta fatia (mockup 2.5, "Para existir de verdade").
 */
export function DialogoDeAjustes({ aoFechar }: { readonly aoFechar: () => void }) {
  return (
    <Dialog titulo="Ajustes" aoFechar={aoFechar}>
      <div className="mt-4 flex min-w-0 flex-col gap-6">
        <Aparencia />
        <TamanhoDaLetra />
      </div>
      <div className="mt-6 flex justify-end">
        <Button variante="secundario" onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    </Dialog>
  )
}
