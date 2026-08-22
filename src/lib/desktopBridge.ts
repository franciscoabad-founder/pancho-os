// Puente hacia el shell de escritorio (Tauri, Fase 2 del plan de migracion).
// Ver C:\Users\Francisco\.claude-rafik\plans\ok-entonces-lo-que-sharded-petal.md
//
// Detecta si la UI corre dentro de la ventana nativa de Tauri (src-tauri/) o
// en un navegador normal / PWA. En navegador, isDesktop() da false y las
// funciones de este archivo nunca se llaman -- el resto del OS sigue
// funcionando exactamente igual que hoy, cero regresion. Solo cuando corre
// dentro de la app de escritorio estas funciones invocan comandos reales de
// Rust via @tauri-apps/api.
//
// IMPORTANTE: cada funcion de aca abajo asume que el comando de Rust
// correspondiente YA existe en src-tauri/src/. Si todavia no se escribio ese
// comando (ver el estado real en src-tauri/src/lib.rs), la funcion debe
// documentarlo con un comentario "TODO Fase 2.x" en vez de fingir que existe.

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type OllamaStatus =
  | { disponible: true; modelos: string[] }
  | { disponible: false; error: string };

// Ping a Ollama (local o via Tailscale, ver ollama.rs) para saber si el
// asistente de escritorio puede usarlo. Comando Rust: "ollama_status"
// (Fase 2.1 del plan, src-tauri/src/ollama.rs).
export async function ollamaStatus(): Promise<OllamaStatus> {
  if (!isDesktop()) return { disponible: false, error: 'No corre en la app de escritorio.' };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<OllamaStatus>('ollama_status');
}
