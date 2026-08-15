const MCP_URL = 'https://brain.franciscoabad.com/mcp';

async function callTool(name: string, args: Record<string, unknown>, token: string): Promise<unknown> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const text = await res.text();
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error(`gbrain: no SSE data for tool ${name}`);

  const envelope = JSON.parse(dataLine.slice(6));
  if (envelope.error) throw new Error(`gbrain: ${envelope.error.message ?? JSON.stringify(envelope.error)}`);

  const content = envelope.result?.content?.[0]?.text;
  if (content === undefined) throw new Error(`gbrain: empty content for tool ${name}`);

  return JSON.parse(content);
}

export interface BrainPage {
  slug: string;
  type: string;
  title: string;
  updated_at: string;
}

export interface BrainPageFull extends BrainPage {
  compiled_truth: string;
  tags: string[];
}

export interface BrainLink {
  target_slug: string;
  target_title?: string;
}

export interface BrainSearchResult {
  slug: string;
  title: string;
  chunk_text: string;
  score: number;
}

// El server de gbrain capa list_pages a 100 filas por llamada aunque se pida
// mas. Este helper pagina por offset hasta traer el corpus completo.
const PAGE_CAP = 100;
const MAX_BATCHES = 20; // tope de seguridad: 2000 paginas

export function createGbrainClient(token: string) {
  const listPages = (args: { limit?: number; offset?: number; sort?: string; tag?: string; type?: string } = {}) =>
    callTool('list_pages', args as Record<string, unknown>, token) as Promise<BrainPage[]>;

  const listAllPages = async (args: { sort?: string; tag?: string; type?: string } = {}) => {
    const all: BrainPage[] = [];
    for (let i = 0; i < MAX_BATCHES; i++) {
      const batch = await listPages({ ...args, limit: PAGE_CAP, offset: i * PAGE_CAP });
      all.push(...batch);
      if (batch.length < PAGE_CAP) break;
    }
    return all;
  };

  return {
    listPages,
    listAllPages,

    listPagesByTag: (tag: string, limit = 50) =>
      callTool('list_pages', { tag, limit, sort: 'updated_desc' }, token) as Promise<BrainPage[]>,

    getPage: (slug: string) =>
      callTool('get_page', { slug }, token) as Promise<BrainPageFull>,

    getLinks: (slug: string) =>
      callTool('get_links', { slug }, token) as Promise<BrainLink[]>,

    search: (query: string, limit = 10) =>
      callTool('search', { query, limit }, token) as Promise<BrainSearchResult[]>,

    query: (query: string, limit = 8) =>
      callTool('query', { query, limit }, token) as Promise<BrainSearchResult[]>,

    // Fuentes de ingesta registradas en gbrain (Telegram, repos, etc.).
    // El shape exacto depende del server; el consumidor debe normalizar.
    sourcesList: () =>
      callTool('sources_list', {}, token) as Promise<unknown>,
  };
}
