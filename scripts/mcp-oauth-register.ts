// CLI para pre-registrar un cliente OAuth del MCP (no hay registro dinamico).
//
// Inserta una fila en mcp_oauth_clients y devuelve el client_id y, si es un
// cliente confidencial, el client_secret UNA sola vez (solo se guarda su hash;
// no hay forma de recuperarlo despues, hay que re-registrar).
//
// Uso (correr en el VPS, donde estan las env de Supabase; Node 22+):
//
//   node --env-file=.env --experimental-strip-types \
//     scripts/mcp-oauth-register.ts \
//     --name "Gemini" \
//     --redirect-uri "https://gemini.google.com/oauth/callback" \
//     --scopes read,write
//
//   Flags:
//     --name <texto>            (requerido) nombre visible del cliente
//     --redirect-uri <url>      (requerido, repetible) redirect_uri exacto
//     --scopes <a,b>            scopes permitidos (default: read)
//     --grant-types <a,b>       default: authorization_code,refresh_token
//     --public                  cliente publico (solo PKCE, sin client_secret)
//     --application-type <t>    web (default) | native. Valida los redirect_uri.
//     --created-by <texto>      etiqueta de auditoria (default: cli)
//
// Requiere en el entorno: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.

import { registrarCliente } from '../src/server/oauth.handlers.ts';

interface Args {
  name?: string;
  redirectUris: string[];
  scopes?: string[];
  grantTypes?: string[];
  publico: boolean;
  applicationType?: string;
  createdBy?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { redirectUris: [], publico: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    switch (a) {
      case '--name': out.name = val(); break;
      case '--redirect-uri': out.redirectUris.push(val()); break;
      case '--scopes': out.scopes = val().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--grant-types': out.grantTypes = val().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--public': out.publico = true; break;
      case '--application-type': out.applicationType = val(); break;
      case '--created-by': out.createdBy = val(); break;
      case '--help': case '-h': out.name = undefined; return out;
      default:
        console.error(`Flag desconocido: ${a}`);
        process.exit(2);
    }
  }
  return out;
}

const uso = `Uso: node --env-file=.env --experimental-strip-types scripts/mcp-oauth-register.ts \\
  --name "<nombre>" --redirect-uri "<url>" [--redirect-uri "<url2>"] \\
  [--scopes read,write] [--grant-types authorization_code,refresh_token] [--public] [--application-type web|native] [--created-by <texto>]`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name || args.redirectUris.length === 0) {
    console.error(uso);
    process.exit(2);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno. Corre con --env-file=.env en el VPS.');
    process.exit(1);
  }

  const registrado = await registrarCliente({
    client_name: args.name,
    redirect_uris: args.redirectUris,
    scopes: args.scopes,
    grant_types: args.grantTypes,
    created_by: args.createdBy,
    publico: args.publico,
    application_type: args.applicationType,
  });

  console.log('\nCliente OAuth registrado. Guarda estos valores (el secret NO se vuelve a mostrar):\n');
  console.log(`  client_id:     ${registrado.client_id}`);
  console.log(`  client_secret: ${registrado.client_secret ?? '(cliente publico, solo PKCE)'}`);
  console.log(`  client_name:   ${registrado.client_name}`);
  console.log(`  redirect_uris: ${registrado.redirect_uris.join(', ')}`);
  console.log(`  scopes:        ${registrado.scopes.join(' ')}`);
  console.log(`  grant_types:   ${registrado.grant_types.join(', ')}`);
  console.log('');
}

main().catch((err) => {
  console.error('Error registrando el cliente:', err instanceof Error ? err.message : err);
  process.exit(1);
});
