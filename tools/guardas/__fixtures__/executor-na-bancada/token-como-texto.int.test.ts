export const modelo = (app: { get: (token: string) => unknown }) => app.get('LLM_PROVIDER')
