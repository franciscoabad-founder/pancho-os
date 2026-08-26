import { useEffect, useState } from 'react';

type Linea = { nombre: string; estado?: string | null };

/** Nombres de líneas asignables: una línea pausada no recibe trabajo nuevo. */
export function useProyectosActivos(): string[] {
  const [proyectos, setProyectos] = useState<string[]>([]);

  useEffect(() => {
    let activo = true;
    fetch('/api/lineas')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d: { lineas?: Linea[] }) => {
        if (activo) setProyectos((d.lineas ?? []).filter((l) => l.estado !== 'pausado').map((l) => l.nombre));
      })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  return proyectos;
}
