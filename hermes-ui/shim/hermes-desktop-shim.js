// Shim web de window.hermesDesktop (Pancho OS, hermes-ui).
// Reemplaza el puente de Electron por fetch y WebSocket contra un proxy del
// mismo origen (/hermes-api) que pone la sesion del dashboard por detras.
// Codigo de Hermes: MIT, Nous Research. Contrato: apps/desktop/electron/preload.ts @ e63b6fa.
;(() => {
  const API = `${location.origin}/hermes-api`
  const WS = API.replace(/^http/, 'ws')
  const NO_WEB = 'No disponible en la versión web de Pancho OS'
  const BLOCKED = [/^\/api\/hermes\/update(?!\/check)/, /^\/api\/gateway\/restart/]
  const log = (...a) => console.info('[hermes-shim]', ...a)
  const unavailable = name => async () => {
    log('no disponible:', name)
    return { ok: false, unavailable: true, error: NO_WEB }
  }
  const noop = () => () => {}

  // Archivos del navegador: la app de escritorio adjunta por ruta local; aqui
  // cada File recibe una ruta virtual y los bytes se leen de memoria.
  const files = new Map()
  let fileSeq = 0
  const register = (blob, name) => {
    const safe = String(name || 'archivo').replace(/[\\/]/g, '_')
    const p = `/web-files/${++fileSeq}/${safe}`
    files.set(p, blob)
    return p
  }
  const readDataUrl = async p => {
    const blob = files.get(p)
    if (!blob) throw new Error(`${NO_WEB}: ${p}`)
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  }
  const pickFiles = options =>
    new Promise(resolve => {
      const input = Object.assign(document.createElement('input'), { type: 'file', multiple: options?.multiple !== false })
      const exts = (options?.filters || []).flatMap(f => f.extensions || []).filter(e => e !== '*')
      if (exts.length) input.accept = exts.map(e => `.${e}`).join(',')
      input.onchange = () => resolve([...(input.files || [])].map(f => register(f, f.name)))
      input.oncancel = () => resolve([])
      input.click()
    })

  const scoped = (path, profile) => {
    if (!profile || profile === 'default') return path
    const u = new URL(path, 'http://h.local')
    if (!u.searchParams.has('profile')) u.searchParams.set('profile', profile)
    return `${u.pathname}${u.search}${u.hash}`
  }

  async function api(req) {
    const path = scoped(String(req?.path || ''), req?.profile)
    const method = String(req?.method || 'GET').toUpperCase()
    if (method !== 'GET' && BLOCKED.some(re => re.test(path))) {
      throw Object.assign(new Error(`403: ${NO_WEB} (actualiza o reinicia el VPS por SSH)`), { statusCode: 403 })
    }
    let body
    const headers = {}
    if (req?.upload) {
      body = new FormData()
      body.append('file', new Blob([req.upload.bytes], { type: req.upload.contentType }), req.upload.filename)
    } else if (req?.body !== undefined) {
      body = JSON.stringify(req.body)
      headers['Content-Type'] = 'application/json'
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), req?.timeoutMs || 60_000)
    try {
      const res = await fetch(API + path, { method, body, headers, signal: ctrl.signal, credentials: 'same-origin' })
      const text = await res.text()
      if (res.status >= 400) throw Object.assign(new Error(`${res.status}: ${text}`), { statusCode: res.status })
      if (!text) return null
      if (/^\s*<(?:!doctype|html)/i.test(text)) throw new Error(`HTML inesperado desde ${path}`)
      const data = JSON.parse(text)
      // Boton Update desactivado: la app lo oculta cuando el backend "no puede aplicar".
      if (path.startsWith('/api/hermes/update/check')) {
        return { ...data, can_apply: false, message: `${NO_WEB}: el VPS se actualiza por SSH` }
      }
      return data
    } finally {
      clearTimeout(timer)
    }
  }

  async function wsUrl(profile) {
    const { ticket } = await api({ path: '/api/auth/ws-ticket', method: 'POST' })
    const u = new URL(`${WS}/api/ws`)
    u.searchParams.set('ticket', ticket)
    if (profile && profile !== 'default') u.searchParams.set('profile', profile)
    return u.toString()
  }

  async function connection(profile) {
    const p = profile && profile !== 'default' ? profile : undefined
    return {
      baseUrl: API,
      mode: 'remote',
      authMode: 'oauth',
      remoteKind: 'url',
      remoteHost: 'VPS Hermes',
      source: 'settings',
      token: null,
      wsUrl: await wsUrl(p),
      connectionId: 'vps',
      ...(p ? { profile: p, sharedRemote: true } : {}),
      isFullscreen: false,
      isMaximized: true,
      nativeOverlayWidth: 0,
      windowButtonPosition: null,
      logs: []
    }
  }

  const wsResult = async profile => {
    try {
      return { ok: true, wsUrl: await wsUrl(profile) }
    } catch (e) {
      return { ok: false, error: String(e?.message || e), needsOauthLogin: e?.statusCode === 401 }
    }
  }

  const registry = {
    version: 2,
    primary: 'vps',
    launchMode: 'primary',
    secureTokenStorage: true,
    connections: [{ id: 'vps', kind: 'remote', label: 'VPS Hermes', remoteUrl: API, authMode: 'oauth' }]
  }

  // Grupos que solo existen en escritorio: cualquier on* devuelve un
  // desuscriptor vacio y cualquier otro metodo responde "no disponible".
  // Cachea cada stub: React compara identidades y una funcion nueva por lectura
  // dispara bucles de render (useSyncExternalStore).
  const stubGroup = (name, overrides = {}) =>
    new Proxy(overrides, {
      get: (t, k) => {
        if (!(k in t) && typeof k === 'string') t[k] = k.startsWith('on') ? noop : unavailable(`${name}.${k}`)
        return t[k]
      }
    })

  const bridge = {
    glassSupported: false,
    translucencySupported: false,
    localModelsEnabled: false,
    guestOnboardingEnabled: false,
    localSkin: null,
    skipIntro: true,
    getConnection: profile => connection(profile),
    getConnectionFor: payload => connection(payload?.profile),
    getGatewayWsUrl: wsResult,
    getGatewayWsUrlFor: payload => wsResult(payload?.profile),
    getProfileRoutes: async profiles =>
      (profiles || []).map(p => ({ connectionId: 'vps', mode: 'remote', profile: p, targetProfile: p })),
    revalidateConnection: async () => ({ ok: true, rebuilt: false }),
    touchBackend: async () => ({ ok: true }),
    getPoolLimits: async () => ({ maxBackends: 1, idleMs: 600_000 }),
    // Una sola fuente remota (el VPS) con un agente por perfil: los bots y su
    // pantalla viajan con descriptor de ruta, no con el nombre suelto del perfil.
    getAgentRoster: async () => {
      const source = { connectionId: 'vps', label: 'VPS Hermes', kind: 'remote' }
      try {
        const { profiles = [] } = (await api({ path: '/api/profiles' })) || {}
        const agents = profiles.map(p => ({
          connectionId: 'vps', connectionKind: 'remote', connectionLabel: source.label,
          profile: p.name, targetProfile: p.name, handle: p.name
        }))
        return { agents, sources: [{ ...source, reachable: true }], primaryConnectionId: 'vps' }
      } catch (e) {
        return { agents: [], sources: [{ ...source, reachable: false, error: String(e) }], primaryConnectionId: 'vps' }
      }
    },
    getBootProgress: async () => ({
      error: null, fakeMode: false, message: 'Conectando al VPS', phase: 'backend.remote',
      progress: 60, running: true, timestamp: Date.now()
    }),
    getBootstrapState: async () => ({
      active: false, manifest: null, stages: {}, error: null, log: [], startedAt: null,
      completedAt: Date.now(), setupChoice: null, unsupportedPlatform: null, bundled: false
    }),
    probeLocalBackend: async () => ({ bootstrapNeeded: false }),
    getConnectionConfig: async () => ({
      envOverride: false, mode: 'remote', profile: null, remoteAuthMode: 'oauth', remoteOauthConnected: true,
      remoteTokenPreview: null, remoteTokenSet: false, remoteUrl: API, secureTokenStorage: true
    }),
    connections: stubGroup('connections', {
      list: async () => registry,
      test: async () => ({ ok: true }),
      updateAll: unavailable('connections.updateAll'),
      updateManaged: unavailable('connections.updateManaged')
    }),
    profile: stubGroup('profile', {
      getDefault: async () => null,
      get: async () => ({ profile: null }),
      remember: async name => ({ profile: name ?? null }),
      set: async name => ({ profile: name ?? null })
    }),
    api,
    notify: async payload => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return false
      new Notification(payload?.title || 'Hermes', { body: payload?.body || '' })
      return true
    },
    openExternal: async url => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return { ok: true }
    },
    openPreviewInBrowser: async url => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return { ok: true }
    },
    writeClipboard: async text => {
      await navigator.clipboard.writeText(String(text ?? ''))
      return true
    },
    readClipboard: async () => navigator.clipboard.readText().catch(() => ''),
    getPathForFile: file => (file instanceof Blob ? register(file, file.name) : ''),
    readFileDataUrl: readDataUrl,
    readFileDataUrlForAttach: readDataUrl,
    selectPaths: pickFiles,
    saveImageBuffer: async (data, ext, name) =>
      register(new Blob([data]), name || `imagen-${Date.now()}${ext?.startsWith('.') ? ext : `.${ext || 'png'}`}`),
    savePastedText: async text => register(new Blob([String(text ?? '')], { type: 'text/plain' }), `pegado-${Date.now()}.txt`),
    saveClipboardImage: async () => {
      try {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find(t => t.startsWith('image/'))
          if (type) return register(await item.getType(type), `portapapeles-${Date.now()}.${type.split('/')[1]}`)
        }
      } catch {}
      return ''
    },
    getVersion: async () => ({
      appVersion: 'web-e63b6fa', electronVersion: 'n/a', nodeVersion: 'n/a', platform: 'web',
      hermesRoot: '', commit: 'e63b6fa', source: 'build', updateMechanism: 'external', bundleOutOfSync: false
    }),
    getRemoteDisplayReason: async () => null,
    updates: stubGroup('updates', {
      check: async () => ({ supported: false, available: false, disabled: true, reason: NO_WEB, behind: 0 }),
      apply: async () => ({ ok: false, error: `${NO_WEB}: actualiza el VPS por SSH` }),
      getBranch: async () => ({ branch: 'main' })
    }),
    zoom: stubGroup('zoom', {
      get: async () => ({ level: 0, percent: 100 }),
      factor: () => 1
    }),
    windowControls: { custom: false, minimize() {}, toggleMaximize() {}, close() {} },
    hud: stubGroup('hud', {
      nativeDrag: false,
      windowing: { clientPlacement: false, controlDrag: false, nativeDrag: false, solid: true, workspaceTransfer: false }
    }),
    screenshot: undefined,
    readWindowBelow: undefined,
    // Consultas locales de escritorio: respuesta vacia del tipo que espera la app.
    getOnBattery: async () => false,
    claimAmbientCue: async () => true,
    signalDeepLinkReady: async () => ({ ok: true }),
    desktopPluginsRoot: async () => '',
    reconcileDesktopPlugins: async () => [],
    logsRoot: async () => '',
    readDir: async () => ({ entries: [], error: NO_WEB }),
    gitRoot: async () => null,
    getSyncStatus: async () => null,
    fetchLinkTitle: async () => '',
    normalizePreviewTarget: async () => null,
    sanitizeWorkspaceCwd: async cwd => ({ cwd: cwd || '', sanitized: false }),
    getRecentLogs: async () => ({ path: '', lines: [] }),
    settings: stubGroup('settings', {
      getDefaultProjectDir: async () => ({ defaultLabel: 'VPS', dir: null, resolvedCwd: '' })
    }),
    reportRendererError: report => console.error('[hermes-shim] renderer error', report),
    logLine: line => console.debug('[hermes]', line)
  }

  // Resto del contrato del preload: existe (como en Electron) pero no aplica en web.
  const groups = [
    'wakeIndicator', 'chatOnboarding', 'introReveal', 'petOverlay', 'hudModifier', 'quickEntry', 'cloud',
    'dataUrlReadMax', 'minimizeToTray', 'mcpOauth', 'git', 'terminal', 'uninstall', 'themes'
  ]
  for (const g of groups) bridge[g] = stubGroup(g)
  bridge.quickEntry.pushState = () => {}
  bridge.petOverlay.pushState = () => {}

  const methods = [
    'openSessionWindow', 'openSessionInTerminal', 'openWindow', 'openBrowserWindow', 'claimAmbientCue',
    'setPoolLimits', 'saveConnectionConfig', 'applyConnectionConfig', 'testConnectionConfig',
    'getSecretStorageEncryption', 'setSecretStorageEncryption', 'sshConfigHosts', 'sshResolveHost',
    'probeConnectionConfig', 'oauthLoginConnectionConfig', 'oauthLogoutConnectionConfig',
    'requestMicrophoneAccess', 'readFileDataUrl', 'readFileDataUrlForAttach', 'readFileText', 'readPluginSource',
    'selectPaths', 'selectSavePath', 'saveGatewayFile', 'saveImageFromUrl', 'contextMenuEdit',
    'contextMenuCopyImage', 'contextMenuSpellcheck', 'contextMenuGuestAddWord', 'saveImageBuffer',
    'capturePreview', 'savePastedText', 'saveClipboardImage', 'normalizePreviewTarget', 'watchPreviewFile',
    'watchDirectory', 'stopPreviewFileWatch', 'reachPreviewUrl', 'fetchLinkTitle', 'resolveFavicon',
    'sanitizeWorkspaceCwd', 'revealLogs', 'getRecentLogs', 'readDir', 'gitRoot', 'revealPath', 'openDir',
    'desktopPluginsRoot', 'reconcileDesktopPlugins', 'logsRoot', 'renamePath', 'writeTextFile', 'trashPath',
    'signalDeepLinkReady', 'probePluginRepo', 'installDesktopPlugin', 'removeDesktopPlugin', 'getOnBattery',
    'continueBootstrapLocal', 'recycleBackend', 'resetBootstrap', 'repairBootstrap', 'cancelBootstrap',
    'relaunchApp', 'getMachineProfile', 'getSyncStatus', 'findInPage', 'stopFindInPage'
  ]
  for (const m of methods) bridge[m] ??= unavailable(m)

  const fireAndForget = [
    'setActiveWork', 'setTitleBarTheme', 'setNativeTheme', 'setTranslucency', 'setKeepAwake', 'setDisableF12',
    'setF12ShortcutActive', 'setPreviewShortcutActive', 'setActiveConnectionRoute'
  ]
  for (const m of fireAndForget) bridge[m] = () => {}

  const events = [
    'onBrowserPopoutClosed', 'onContextMenuSpellcheck', 'onF12Shortcut', 'onClosePreviewRequested', 'onPreviewNav',
    'onOpenFolderRequested', 'onOpenUpdatesRequested', 'onDeepLink', 'onWindowStateChanged', 'onFocusSession',
    'onNotificationAction', 'onNotificationActivate', 'onPreviewFileChanged', 'onBackendExit',
    'onPoolBackendRetiring', 'onConnectionApplied', 'onPowerResume', 'onBatteryChanged', 'onBootProgress',
    'onBootstrapEvent', 'onFoundInPage', 'onOpenFindBarRequested', 'onExternalOpenFailed'
  ]
  for (const e of events) bridge[e] = noop

  window.hermesDesktop = bridge
  log('listo, backend via', API)
})()
