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

// Solo los NOMBRES de las entradas con nombre, nunca los valores. Existe para
// que /sistema pueda mostrar "kimi" y "grok" como dispositivos de solo lectura
// junto a los de os_devices: hasta ahora esas keys eran completamente invisibles
// desde la app. Una entrada sin ':' (el formato viejo, token pelado) no tiene
// nombre y se omite, porque mostrar el token seria filtrarlo a la pantalla.
export function parseNombresTokens(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entrada) => {
      const idx = entrada.indexOf(':');
      return idx > 0 ? entrada.slice(0, idx).trim() : '';
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
