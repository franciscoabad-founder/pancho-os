// Capturas de la prueba Fase 0 con Chromium headless (sin ventanas visibles).
// Uso: node spikes/hermes-web/capture.mjs  (con server.mjs corriendo en :4390)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '.work', 'src-e63b6fa197', 'package.json'))
const { chromium } = require('playwright-core')

const BASE = process.env.SPIKE_URL || 'http://127.0.0.1:4390'
const OUT = process.env.CAPTURAS_DIR || path.resolve(here, '..', 'docs', 'fase1-capturas')
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243',
  'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
const CHAT = process.env.SPIKE_CHAT || '20260928_220020_03515d'
const TELEGRAM = process.env.SPIKE_TELEGRAM || '20260928_201110_5087bac6'

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: EXE })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))

const wait = ms => page.waitForTimeout(ms)
const shot = async name => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log('captura', name)
}
const go = async (hash, ms = 6000) => {
  await page.evaluate(h => (location.hash = h), hash)
  await wait(ms)
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await wait(15000)
await shot('01-inicio-sesiones')
await go(`#/${CHAT}`)
await shot('02-chat-respuesta-del-vps')
await go('#/capabilities')
await shot('03-capabilities-skills')
await go('#/capabilities?tab=connectors')
await shot('04-capabilities-conectores-mcp')
await go('#/capabilities?tab=plugins')
await shot('05-capabilities-plugins')
await go('#/cron')
await shot('06-tareas-programadas')
await go(`#/${TELEGRAM}`)
await shot('07-sesion-de-telegram')

await page.getByText('Bots', { exact: true }).first().click()
await wait(4000)
await shot('08-bots-por-perfil')
await page.getByRole('button', { name: /^Hermes · @hermes/ }).click({ button: 'right' })
await page.getByRole('menuitem', { name: 'Open Screen' }).click()
await wait(12000)
await shot('09-pantalla-del-bot')
const takeOver = page.getByRole('button', { name: 'Take over' })
if (await takeOver.isEnabled().catch(() => false)) {
  await takeOver.click()
  await wait(4000)
  await shot('10-pantalla-del-bot-tomada-hand-back')
  await page.getByRole('button', { name: 'Hand back', exact: true }).click()
  await wait(3000)
}

const badge = page.getByText(/backend v/).first()
if (await badge.isVisible().catch(() => false)) {
  await badge.click()
  await wait(3000)
  const dialog = await page.getByRole('dialog').innerText().catch(() => '')
  console.log('dialogo update:', dialog.replace(/\n+/g, ' | '), '| boton Update now:', /Update now/.test(dialog))
  await shot('11-update-desactivado')
}

fs.writeFileSync(path.join(OUT, 'errores-de-pagina.txt'), errors.join('\n') || 'sin errores de pagina')
await browser.close()
console.log('listo', OUT, 'errores:', errors.length)
