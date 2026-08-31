// Hook chico para la burbuja flotante de Taski: maneja arrastre (pointer
// events), clamp a los limites de pantalla, y persistencia de posicion +
// estado oculto en localStorage. Sin dependencias de React fuera de hooks
// basicos, para poder reusarlo si otra burbuja lo necesita.
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'os.taski.bubble.v1';
const DRAG_THRESHOLD_PX = 8;

interface EstadoGuardado {
  x: number;
  y: number;
  oculto: boolean;
}

function leerEstadoGuardado(): EstadoGuardado | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.oculto === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function guardarEstado(estado: EstadoGuardado) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Storage no disponible (modo privado, cuota, etc.): la burbuja sigue
    // funcionando, simplemente no recuerda posicion entre recargas.
  }
}

function clamp(valor: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(valor, min), max);
}

interface UseDraggableBubbleOpts {
  size: number;
  margin?: number;
  bottomReservado?: number;
}

interface UseDraggableBubbleResult {
  pos: { x: number; y: number } | null;
  oculto: boolean;
  arrastrando: boolean;
  ocultar: () => void;
  mostrar: () => void;
  onPointerDown: (e: import('react').PointerEvent<HTMLElement>) => void;
  registrarComoTap: (cb: () => void) => (e: import('react').PointerEvent<HTMLElement>) => void;
}

// Posicion por defecto: esquina inferior derecha, igual que antes de existir
// el drag. Se calcula en el primer layout porque depende de innerWidth/Height.
function posicionPorDefecto(size: number, margin: number, bottomReservado: number) {
  return {
    x: window.innerWidth - size - margin,
    y: window.innerHeight - size - margin - bottomReservado,
  };
}

export function useDraggableBubble({
  size,
  margin = 14,
  bottomReservado = 0,
}: UseDraggableBubbleOpts): UseDraggableBubbleResult {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [oculto, setOculto] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const arrastreInfo = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    movio: boolean;
    pointerId: number;
  } | null>(null);

  // Carga inicial: posicion guardada o default, clampeada a la ventana actual
  // (por si cambio el tamano de pantalla entre sesiones).
  useEffect(() => {
    const guardado = leerEstadoGuardado();
    const maxX = Math.max(0, window.innerWidth - size);
    const maxY = Math.max(0, window.innerHeight - size);
    if (guardado) {
      setPos({ x: clamp(guardado.x, 0, maxX), y: clamp(guardado.y, 0, maxY) });
      setOculto(guardado.oculto);
    } else {
      const def = posicionPorDefecto(size, margin, bottomReservado);
      setPos({ x: clamp(def.x, 0, maxX), y: clamp(def.y, 0, maxY) });
    }
    // Solo al montar: la posicion la maneja el usuario despues.
  }, []);

  // Re-clamp si la ventana cambia de tamano (rotacion, resize de navegador).
  useEffect(() => {
    function onResize() {
      setPos((prev) => {
        if (!prev) return prev;
        const maxX = Math.max(0, window.innerWidth - size);
        const maxY = Math.max(0, window.innerHeight - size);
        return { x: clamp(prev.x, 0, maxX), y: clamp(prev.y, 0, maxY) };
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size]);

  const persistir = useCallback(
    (siguiente: { x: number; y: number }, ocultoSiguiente: boolean) => {
      guardarEstado({ x: siguiente.x, y: siguiente.y, oculto: ocultoSiguiente });
    },
    [],
  );

  const ocultar = useCallback(() => {
    setOculto(true);
    setPos((prev) => {
      if (prev) persistir(prev, true);
      return prev;
    });
  }, [persistir]);

  const mostrar = useCallback(() => {
    setOculto(false);
    setPos((prev) => {
      if (prev) persistir(prev, false);
      return prev;
    });
  }, [persistir]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const info = arrastreInfo.current;
      if (!info) return;
      const dx = e.clientX - info.startX;
      const dy = e.clientY - info.startY;
      if (!info.movio && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        info.movio = true;
        setArrastrando(true);
      }
      if (!info.movio) return;
      const maxX = Math.max(0, window.innerWidth - size);
      const maxY = Math.max(0, window.innerHeight - size - bottomReservado);
      setPos({
        x: clamp(info.origX + dx, 0, maxX),
        y: clamp(info.origY + dy, 0, maxY),
      });
    },
    [size, bottomReservado],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const info = arrastreInfo.current;
      arrastreInfo.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if (!info) return;
      if (info.movio) {
        setPos((prev) => {
          if (prev) persistir(prev, oculto);
          return prev;
        });
      }
      // Deja "arrastrando" prendido un tick para que el click sintetico que
      // dispara el navegador despues de pointerup no abra el chat.
      setTimeout(() => setArrastrando(false), 0);
      void e;
    },
    [onPointerMove, persistir, oculto],
  );

  const onPointerDown = useCallback(
    (e: import('react').PointerEvent<HTMLElement>) => {
      if (e.button !== undefined && e.button !== 0) return;
      setPos((prev) => {
        arrastreInfo.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: prev?.x ?? 0,
          origY: prev?.y ?? 0,
          movio: false,
          pointerId: e.pointerId,
        };
        return prev;
      });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  // Envuelve un click handler para que solo dispare si NO hubo drag (tap).
  const registrarComoTap = useCallback(
    (cb: () => void) => (e: import('react').PointerEvent<HTMLElement>) => {
      if (arrastrando || arrastreInfo.current?.movio) return;
      void e;
      cb();
    },
    [arrastrando],
  );

  return { pos, oculto, arrastrando, ocultar, mostrar, onPointerDown, registrarComoTap };
}
