// OSGrabar — grabadora de reuniones del OS.
// - MediaRecorder (audio/webm;codecs=opus) con chunks de ~30s guardados en
//   IndexedDB durante la grabacion para sobrevivir crashes o cierres.
// - Wake Lock mientras graba para que la pantalla no se apague en movil.
// - Al detener se ensambla el Blob y se sube DIRECTO a Supabase Storage con una
//   signed URL (el audio nunca pasa por Vercel). Luego /api/os/grabaciones
//   action=done dispara el pipeline de transcripcion en n8n.
// - Si al cargar hay una grabacion sin subir en IndexedDB, se ofrece recuperarla.
import { useEffect, useRef, useState } from 'react';
import { Button, Card, FieldInput, Spinner } from './ui';

const PROYECTOS = ['braintech', 'rafik', 'cortex', 'taskr', 'arazza', 'codeis', 'marca', 'personal', 'otros'];
const CHUNK_MS = 30_000;

// ── IndexedDB ──────────────────────────────────────────────────────────────
const DB_NAME = 'os-grabaciones';
const DB_VERSION = 1;

interface Sesion {
  id: string;
  titulo: string;
  proyecto: string;
  mime: string;
  iniciada: string; // ISO
  duracion_s: number;
}

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sesiones')) {
        db.createObjectStore('sesiones', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        const store = db.createObjectStore('chunks', { autoIncrement: true });
        store.createIndex('porSesion', 'sesion');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    const req = fn(t);
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function guardarSesion(s: Sesion) {
  const db = await abrirDB();
  try { await tx(db, ['sesiones'], 'readwrite', (t) => { t.objectStore('sesiones').put(s); }); } finally { db.close(); }
}

async function guardarChunk(sesion: string, idx: number, blob: Blob) {
  const db = await abrirDB();
  try { await tx(db, ['chunks'], 'readwrite', (t) => { t.objectStore('chunks').add({ sesion, idx, blob }); }); } finally { db.close(); }
}

async function leerSesiones(): Promise<Sesion[]> {
  const db = await abrirDB();
  try {
    return await tx<Sesion[]>(db, ['sesiones'], 'readonly', (t) => t.objectStore('sesiones').getAll() as IDBRequest<Sesion[]>);
  } finally { db.close(); }
}

async function leerChunks(sesion: string): Promise<Blob[]> {
  const db = await abrirDB();
  try {
    const rows = await tx<{ sesion: string; idx: number; blob: Blob }[]>(
      db, ['chunks'], 'readonly',
      (t) => t.objectStore('chunks').index('porSesion').getAll(sesion) as IDBRequest<{ sesion: string; idx: number; blob: Blob }[]>,
    );
    return rows.sort((a, b) => a.idx - b.idx).map((r) => r.blob);
  } finally { db.close(); }
}

async function borrarSesion(sesion: string) {
  const db = await abrirDB();
  try {
    await tx(db, ['sesiones', 'chunks'], 'readwrite', (t) => {
      t.objectStore('sesiones').delete(sesion);
      const idx = t.objectStore('chunks').index('porSesion');
      const cursorReq = idx.openCursor(sesion);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    });
  } finally { db.close(); }
}

// ── Utilidades ─────────────────────────────────────────────────────────────
function elegirMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidatos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidatos.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

function fmtTiempo(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(seg).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Estado = 'inactivo' | 'grabando' | 'pausado' | 'listo' | 'subiendo' | 'subido';

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 5,
  fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 600,
  letterSpacing: '0.04em', color: 'var(--os-muted)',
};

export default function OSGrabar() {
  const [estado, setEstado] = useState<Estado>('inactivo');
  const [titulo, setTitulo] = useState('');
  const [proyecto, setProyecto] = useState('otros');
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState('');
  const [blobListo, setBlobListo] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [recuperable, setRecuperable] = useState<Sesion | null>(null);
  const [progreso, setProgreso] = useState('');

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sesionRef = useRef<Sesion | null>(null);
  const chunkIdxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segundosRef = useRef(0);
  const estadoRef = useRef<Estado>('inactivo');
  estadoRef.current = estado;

  // Sesion sin subir de una carga anterior → ofrecer recuperarla.
  useEffect(() => {
    (async () => {
      try {
        const sesiones = await leerSesiones();
        if (!sesiones.length) return;
        sesiones.sort((a, b) => (a.iniciada < b.iniciada ? 1 : -1));
        setRecuperable(sesiones[0]);
      } catch { /* IndexedDB no disponible: seguimos sin recuperacion */ }
    })();
  }, []);

  // Wake Lock: re-adquirir si la pestana vuelve a estar visible mientras se graba.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && (estadoRef.current === 'grabando' || estadoRef.current === 'pausado')) {
        pedirWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => () => {
    // Cleanup al desmontar: liberar mic y wake lock (los chunks quedan en IndexedDB).
    try { recRef.current?.stop(); } catch { /* ya detenido */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wakeLockRef.current?.release().catch(() => {});
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pedirWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch { /* sin wake lock no bloqueamos la grabacion */ }
  }

  function soltarWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  function arrancarTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      segundosRef.current += 1;
      setSegundos(segundosRef.current);
      if (sesionRef.current) sesionRef.current.duracion_s = segundosRef.current;
    }, 1000);
  }

  function pararTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function grabar() {
    setError('');
    const mime = elegirMime();
    if (!mime) { setError('Este navegador no soporta grabacion de audio.'); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('No se pudo acceder al microfono. Revisa los permisos del navegador.');
      return;
    }
    streamRef.current = stream;
    const sesion: Sesion = {
      id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      titulo, proyecto, mime,
      iniciada: new Date().toISOString(),
      duracion_s: 0,
    };
    sesionRef.current = sesion;
    chunkIdxRef.current = 0;
    segundosRef.current = 0;
    setSegundos(0);
    try { await guardarSesion(sesion); } catch { /* sin IndexedDB igual grabamos */ }

    const rec = new MediaRecorder(stream, { mimeType: mime });
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0 || !sesionRef.current) return;
      const idx = chunkIdxRef.current++;
      guardarChunk(sesionRef.current.id, idx, e.data).catch(() => {});
      guardarSesion({ ...sesionRef.current }).catch(() => {});
    };
    rec.onstop = async () => {
      pararTimer();
      soltarWakeLock();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      // Pequena espera: el ultimo ondataavailable puede llegar justo despues de stop.
      await new Promise((r) => setTimeout(r, 250));
      const s = sesionRef.current;
      if (!s) return;
      try {
        const chunks = await leerChunks(s.id);
        if (!chunks.length) { setError('No se capturo audio.'); setEstado('inactivo'); return; }
        const blob = new Blob(chunks, { type: s.mime.split(';')[0] });
        setBlobListo(blob);
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setEstado('listo');
      } catch (err) {
        setError(`No se pudo ensamblar la grabacion: ${String(err)}`);
        setEstado('inactivo');
      }
    };
    rec.start(CHUNK_MS);
    await pedirWakeLock();
    arrancarTimer();
    setEstado('grabando');
  }

  function pausar() {
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    // Forzar volcado del buffer actual a IndexedDB al pausar.
    try { rec.requestData(); } catch { /* opcional */ }
    pararTimer();
    setEstado('pausado');
  }

  function reanudar() {
    const rec = recRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    arrancarTimer();
    setEstado('grabando');
  }

  function detener() {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return;
    rec.stop();
  }

  async function recuperar() {
    if (!recuperable) return;
    setError('');
    try {
      const chunks = await leerChunks(recuperable.id);
      if (!chunks.length) {
        await borrarSesion(recuperable.id);
        setRecuperable(null);
        setError('La grabacion pendiente no tenia audio y se descarto.');
        return;
      }
      const blob = new Blob(chunks, { type: recuperable.mime.split(';')[0] });
      sesionRef.current = recuperable;
      segundosRef.current = recuperable.duracion_s;
      setSegundos(recuperable.duracion_s);
      setTitulo(recuperable.titulo);
      setProyecto(recuperable.proyecto);
      setBlobListo(blob);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      setRecuperable(null);
      setEstado('listo');
    } catch (err) {
      setError(`No se pudo recuperar: ${String(err)}`);
    }
  }

  async function descartarRecuperable() {
    if (!recuperable) return;
    try { await borrarSesion(recuperable.id); } catch { /* mejor esfuerzo */ }
    setRecuperable(null);
  }

  async function descartarListo() {
    const s = sesionRef.current;
    if (s) { try { await borrarSesion(s.id); } catch { /* mejor esfuerzo */ } }
    sesionRef.current = null;
    setBlobListo(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    segundosRef.current = 0;
    setSegundos(0);
    setEstado('inactivo');
  }

  async function subir() {
    const s = sesionRef.current;
    const blob = blobListo;
    if (!s || !blob) return;
    setEstado('subiendo');
    setError('');
    try {
      setProgreso('Creando URL de subida...');
      const mime = s.mime.split(';')[0];
      const resStart = await fetch('/api/os/grabaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mime }),
      });
      const dataStart = await resStart.json();
      if (!resStart.ok || !dataStart.uploadUrl) throw new Error(dataStart.error || `HTTP ${resStart.status}`);

      setProgreso(`Subiendo audio (${fmtBytes(blob.size)})...`);
      const resUp = await fetch(dataStart.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: blob,
      });
      if (!resUp.ok) throw new Error(`Fallo la subida a Storage (HTTP ${resUp.status})`);

      setProgreso('Enviando a transcripcion...');
      const resDone = await fetch('/api/os/grabaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'done',
          path: dataStart.path,
          titulo: titulo.trim(),
          proyecto,
          duracion: segundosRef.current,
          mime,
        }),
      });
      const dataDone = await resDone.json();
      if (!resDone.ok || !dataDone.ok) throw new Error(dataDone.error || `HTTP ${resDone.status}`);

      try { await borrarSesion(s.id); } catch { /* mejor esfuerzo */ }
      sesionRef.current = null;
      setBlobListo(null);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
      setProgreso('');
      setEstado('subido');
    } catch (err) {
      setProgreso('');
      setError(err instanceof Error ? err.message : String(err));
      setEstado('listo');
    }
  }

  function nuevaGrabacion() {
    setTitulo('');
    segundosRef.current = 0;
    setSegundos(0);
    setError('');
    setEstado('inactivo');
  }

  const grabando = estado === 'grabando' || estado === 'pausado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      {recuperable && estado === 'inactivo' && (
        <Card variant="sunken">
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', marginBottom: 4, fontWeight: 600 }}>
            Hay una grabacion sin subir
          </p>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', marginBottom: 10 }}>
            {recuperable.titulo || 'Sin titulo'} · {new Date(recuperable.iniciada).toLocaleString('es-EC')} · ~{fmtTiempo(recuperable.duracion_s)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={recuperar}>Recuperar</Button>
            <Button size="sm" variant="danger" onClick={descartarRecuperable}>Descartar</Button>
          </div>
        </Card>
      )}

      {(estado === 'inactivo' || grabando) && (
        <>
          <FieldInput
            label="Titulo (opcional)"
            placeholder="Reunion con..."
            value={titulo}
            maxLength={160}
            disabled={grabando}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <div>
            <span style={labelStyle}>Proyecto</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PROYECTOS.map((p) => {
                const activo = proyecto === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={grabando}
                    onClick={() => setProyecto(p)}
                    style={{
                      padding: '5px 12px', minHeight: 36, borderRadius: 7, cursor: grabando ? 'default' : 'pointer',
                      fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 700,
                      letterSpacing: '0.03em',
                      background: activo ? 'rgba(59,78,217,0.14)' : 'var(--os-fill-subtle)',
                      color: activo ? 'var(--os-accent-light)' : 'var(--os-muted)',
                      border: activo ? '1px solid var(--os-line-accent)' : '1px solid var(--os-line-soft)',
                      opacity: grabando && !activo ? 0.5 : 1,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '10px 0' }}>
              <span
                style={{
                  fontFamily: 'var(--os-font-mono, monospace)', fontSize: 40, fontWeight: 700,
                  color: grabando ? 'var(--os-text)' : 'var(--os-muted)',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
                }}
              >
                {fmtTiempo(segundos)}
              </span>

              {estado === 'grabando' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--os-text-xs)', color: '#D4537E', fontFamily: 'var(--os-font-display)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#D4537E', animation: 'os-pulse 1.4s ease-in-out infinite' }} />
                  Grabando
                </span>
              )}
              {estado === 'pausado' && (
                <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-display)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  En pausa
                </span>
              )}

              {estado === 'inactivo' && (
                <button
                  type="button"
                  onClick={grabar}
                  aria-label="Empezar a grabar"
                  style={{
                    width: 96, height: 96, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'var(--os-accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(59,78,217,0.35)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 42 }}>mic</span>
                </button>
              )}

              {grabando && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {estado === 'grabando'
                    ? <Button variant="ghost" onClick={pausar}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>pause</span> Pausar</Button>
                    : <Button variant="ghost" onClick={reanudar}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span> Reanudar</Button>}
                  <Button onClick={detener}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop</span> Detener</Button>
                </div>
              )}

              {estado === 'inactivo' && (
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', textAlign: 'center', maxWidth: 320 }}>
                  El audio se guarda en tu dispositivo cada 30 segundos mientras grabas.
                  Si algo se cierra, puedes recuperar la grabacion al volver.
                </p>
              )}
            </div>
          </Card>
        </>
      )}

      {estado === 'listo' && blobListo && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)' }}>
              Grabacion lista · {fmtTiempo(segundos)} · {fmtBytes(blobListo.size)}
            </p>
            {previewUrl && <audio controls src={previewUrl} style={{ width: '100%' }} />}
            <FieldInput
              label="Titulo (opcional)"
              placeholder="Reunion con..."
              value={titulo}
              maxLength={160}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <div>
              <span style={labelStyle}>Proyecto</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PROYECTOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProyecto(p)}
                    style={{
                      padding: '5px 12px', minHeight: 36, borderRadius: 7, cursor: 'pointer',
                      fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 700,
                      background: proyecto === p ? 'rgba(59,78,217,0.14)' : 'var(--os-fill-subtle)',
                      color: proyecto === p ? 'var(--os-accent-light)' : 'var(--os-muted)',
                      border: proyecto === p ? '1px solid var(--os-line-accent)' : '1px solid var(--os-line-soft)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={subir}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span> Subir al cerebro</Button>
              <Button variant="danger" onClick={descartarListo}>Descartar</Button>
            </div>
          </div>
        </Card>
      )}

      {estado === 'subiendo' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <Spinner inline />
            <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>{progreso || 'Subiendo...'}</span>
          </div>
        </Card>
      )}

      {estado === 'subido' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontWeight: 600 }}>
              Grabacion enviada al cerebro
            </p>
            <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              n8n la esta transcribiendo y resumiendo. La nota aparecera en gbrain en unos minutos.
            </p>
            <Button size="sm" onClick={nuevaGrabacion}>Nueva grabacion</Button>
          </div>
        </Card>
      )}

      {error && (
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-error, #D4537E)' }}>{error}</p>
      )}
    </div>
  );
}
