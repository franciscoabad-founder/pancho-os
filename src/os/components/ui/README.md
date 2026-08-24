# UI compartida del OS

Componentes React con tokens `--os-*` (claymorfismo Ultramarine v5). Sin dependencias nuevas.
Regla de color: hecho/completado = champagne, accion/CTA = ultramarine, danger = #D4537E, CERO verde.

## Ejemplos

```tsx
import { PageHeader, Button } from '../ui';
<PageHeader eyebrow="Control" title="Tareas" subtitle="Todo lo activo"
  actions={<Button size="sm" onClick={crear}>Nueva</Button>} />
```

```tsx
<Button variant="danger" size="sm" onClick={borrar}>Eliminar</Button>
// variantes: primary | secondary | ghost | danger; tamanos: sm | md
```

```tsx
<Card variant="sunken" interactive onClick={abrir}>contenido</Card>
<EmptyState icon="inbox" title="Nada por revisar" text="La bandeja esta vacia."
  action={<Button size="sm">Capturar</Button>} />
```

```tsx
{loading ? <Spinner /> : null}
<Spinner inline label="Guardando..." />
```

```tsx
<FieldInput label="Nombre" value={v} onChange={(e) => setV(e.target.value)} />
<FieldSelect label="Tipo" value={t} onChange={(e) => setT(e.target.value)}>
  <option value="a">A</option>
</FieldSelect>
```

```tsx
<Tabs tabs={[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana', count: 4 }]}
  active={tab} onChange={setTab} />
// flechas izquierda/derecha navegan; fill reparte el ancho en partes iguales
```

```tsx
// Reemplaza el patron .os-kpi hand-rolled. El valor sale en champagne.
<MetricCard label="Disponible en cuentas" value={money(totCuentas)} />
<MetricCard label="Total deudas" value={money(totDeudas)} trend="+8%" trendTone="error"
  icon="credit_card" hint="vs mes anterior" />
<MetricCard label="Neto" value={money(neto)} size="lg" accent />
```

```tsx
<ProgressBar value={72} label="Proteina" valueLabel="144 / 200 g" />
<ProgressBar value={sets} max={maxSets} size="sm" ariaLabel="Series completadas" />
// tonos: accent | metric | warn | error
```

```tsx
<Badge tone="ok" icon="check">Hecho</Badge>
<Badge tone="warn" dot>En riesgo</Badge>
// tonos: neutral | accent | metric | ok | warn | error
```

```tsx
<Tooltip label="Suma de cuentas menos deudas" placement="top">
  <span className="material-symbols-outlined">info</span>
</Tooltip>
// posicionamiento basico: sin deteccion de colision con el viewport
```

```tsx
<Switch checked={activo} onChange={setActivo} label="Penalizar HP al fallar"
  hint="Resta 5 HP por habito no cumplido" block />
```

```tsx
<Sheet open={abierto} onClose={() => setAbierto(false)} title="Editar"
  footer={<Button onClick={guardar}>Guardar</Button>}>
  formulario...
</Sheet>
// bottom-sheet en movil, modal centrado en desktop; Escape y click fuera cierran
```

```tsx
// En la raiz de la isla: <ToastProvider>...</ToastProvider>
const toast = useToast();
toast.show('Guardado', 'ok');       // reemplaza alert()
toast.show('Fallo al guardar', 'error');
```

```tsx
// Reemplaza window.confirm(). const { confirm, sheet } = useConfirm(); en el componente,
// {sheet} una vez en el JSX (no requiere estar en la raiz de la isla).
const { confirm, sheet } = useConfirm();
async function eliminar(id: string) {
  if (!(await confirm({ title: 'Eliminar tarea', text: 'Esta accion no se puede deshacer.', confirmLabel: 'Eliminar', danger: true }))) return;
  // ...fetch DELETE...
}
// en el JSX: {sheet}
```

```tsx
const { data, loading, error, reload, mutate } = useResource<Tarea[]>('/api/os/tareas');
```
