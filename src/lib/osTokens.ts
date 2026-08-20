// Tokens de API del OS con nombre por cliente.
//
// OS_API_TOKENS="kimi:abc123,grok:xyz789" da a cada agente su propia key,
// revocable individualmente quitando su entrada del .env (mismo patron que
// gbrain auth y los peers A2A). El OS_API_TOKEN legacy sigue valiendo como
// token maestro: lo usan Hermes, n8n y el propio MCP para llamadas internas.

export function parseNamedTokens(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entrada) => {
      const idx = entrada.indexOf(':');
      return (idx >= 0 ? entrada.slice(idx + 1) : entrada).trim();
    })
    .filter(Boolean);
}

export function esTokenValido(
  candidato: string | null | undefined,
  maestro: string | undefined | null,
  listaRaw?: string | undefined | null,
): boolean {
  if (!candidato) return false;
  if (maestro && candidato === maestro) return true;
  return parseNamedTokens(listaRaw).includes(candidato);
}
