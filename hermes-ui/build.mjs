// Compila el renderer de Hermes Desktop como web, desde el MISMO commit que
// corre el backend del VPS (otra version rompe la API). Usa el package-lock
// del monorepo: con versiones sueltas el chat se cae (ver docs/plan-hermes-en-os.md).
// Uso: node hermes-ui/build.mjs --commit e63b6fa [--repo <checkout de hermes-agent>]
// Salida: hermes-ui/.work/dist (build + shim + build-info.json). No toca el repo de Hermes.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const here = path.dirname(fileURLToPath(import.meta.url))
const { values } = parseArgs({
  options: {
    commit: { type: 'string' },
    repo: { type: 'string', default: 'C:\\Users\\Francisco\\AppData\\Local\\hermes\\hermes-agent' }
  }
})
if (!values.commit) throw new Error('Falta --commit (el de `hermes --version` en el VPS)')

const WORK = path.join(here, '.work')
const OUT = path.join(WORK, 'dist')

function run(cmd, args, cwd, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd, stdio: opts.capture ? 'pipe' : 'inherit', windowsHide: true, shell: process.platform === 'win32' && /^np[mx]$/.test(cmd), encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${cmd} fallo (${r.status}) ${r.stderr || ''}`)
  return r.stdout
}

const git = (...args) => run('git', ['-C', values.repo, ...args], here, { capture: true }).trim()
const commit = git('rev-parse', '--short=10', `${values.commit}^{commit}`)
const src = path.join(WORK, `src-${commit}`)

if (!fs.existsSync(path.join(src, 'apps', 'desktop', 'package.json'))) {
  fs.mkdirSync(src, { recursive: true })
  // Manifiestos de todos los workspaces: `npm ci` los necesita para respetar el lock.
  const manifests = git('ls-tree', '-r', '--name-only', commit)
    .split('\n')
    .filter(f => /^(apps\/[^/]+|ui-tui|ui-tui\/packages\/[^/]+|web|tests-js)\/package\.json$/.test(f))
  const tar = path.join(WORK, `hermes-${commit}.tar`)
  git('archive', '--format=tar', '-o', tar, commit, 'package.json', 'package-lock.json', 'LICENSE',
    'apps/desktop', 'apps/shared', ...manifests)
  run('tar', ['-xf', tar, '-C', src], here)
  fs.rmSync(tar)
}

if (!fs.existsSync(path.join(src, 'node_modules', '@assistant-ui'))) {
  // `web` entra porque el escritorio usa lucide-react, que solo declara ese workspace.
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--workspace', 'apps/desktop',
    '--workspace', 'web', '--include-workspace-root'], src)
}

const desktop = path.join(src, 'apps', 'desktop')
run('npx', ['vite', 'build'], desktop)

fs.rmSync(OUT, { recursive: true, force: true })
fs.cpSync(path.join(desktop, 'dist'), OUT, { recursive: true })
// Fuentes de @nous-research/ui referenciadas con ruta absoluta /node_modules/...
const fonts = 'node_modules/@nous-research/ui/dist/fonts'
fs.cpSync(path.join(src, fonts), path.join(OUT, fonts), { recursive: true })
fs.copyFileSync(path.join(here, 'shim', 'hermes-desktop-shim.js'), path.join(OUT, 'hermes-desktop-shim.js'))
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(OUT, 'HERMES-LICENSE.txt'))
fs.writeFileSync(path.join(OUT, 'build-info.json'), JSON.stringify({ commit, builtAt: new Date().toISOString() }, null, 2))
console.log(`listo: ${OUT} (commit ${commit})`)
