// O módulo que o `import()` da fixture ao lado carrega: chama o `fetch` do escopo global, e é barrado aqui.

export const fetchDeFora = () => fetch('/v1/eu') /* reprova: no-restricted-globals */
