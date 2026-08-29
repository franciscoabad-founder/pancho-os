# Agenda y Google Calendar: cierre operativo

Estado: código y pruebas listos. Antes de desplegar se requiere una migración manual de Supabase y, para sincronización real, una configuración OAuth hecha por Francisco.

## Qué resuelve esta entrega

- La agenda muestra catorce días consecutivos en `America/Guayaquil`, incluidos sábado y domingo aunque no haya ningún evento.
- Se pueden crear, editar y eliminar eventos desde `/agenda`.
- Las etiquetas se escriben como texto separado por comas. El OS las normaliza a minúsculas, elimina duplicados y las muestra como `#etiqueta`.
- Los cambios hechos en el OS se exportan a Google en la siguiente sincronización, sin ser pisados primero por una importación.
- Al eliminar un evento vinculado, el OS lo oculta de inmediato y lo cancela en Google durante la próxima sincronización.
- La herramienta MCP puede actualizar eventos y solicitar una sincronización. Toda sincronización que pueda alterar Google exige una confirmación explícita MRTR.

## Parte 1: migración de Supabase

Esta parte debe hacerse antes de subir el commit a `master`, porque el despliegue automático compila y reinicia el proceso que atiende `os.franciscoabad.com`.

1. Entra a [Supabase Dashboard](https://supabase.com/dashboard) y abre el proyecto `yfrrfmankgodpepbgyvu` de Pancho OS.
2. Abre **SQL Editor** y crea una consulta nueva.
3. Abre el archivo local `C:\DEV\Pancho-OS\supabase\migrations\20260829000000_agenda_editable_sync.sql`.
4. Copia todo su contenido en el editor y presiona **Run**.
5. La consulta es aditiva e idempotente. Es correcto ejecutarla una sola vez. No borra reuniones ni modifica RLS.
6. Verifica que la respuesta sea exitosa y corre esta consulta de comprobación:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reuniones'
  and column_name in (
    'google_event_id', 'google_etag', 'google_updated_at',
    'google_dirty_at', 'google_deleted_at', 'etiquetas'
  )
order by column_name;
```

Debe devolver seis filas. Si no devuelve seis, no hacer deploy todavía.

## Parte 2: OAuth de Google Calendar

Haz esta parte solo cuando quieras que el OS pueda leer y modificar Google Calendar. Sin esas tres variables, el botón de sincronización devuelve un error claro y no altera nada.

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto nuevo, por ejemplo `pancho-os-calendar`, o abre el proyecto que quieras usar exclusivamente para el OS.
3. En **APIs & Services → Library**, habilita **Google Calendar API**.
4. En **APIs & Services → OAuth consent screen**, elige **External** si usarás una cuenta Gmail normal. Completa nombre de app y correo. En modo Testing agrega tu correo de Google como **Test user**.
5. En **Credentials → Create credentials → OAuth client ID**, crea un cliente de tipo **Desktop app**. Copia `Client ID` y `Client secret`.
6. Genera un refresh token con acceso de calendario de lectura y escritura. El scope que necesita Pancho OS es exactamente:

```text
https://www.googleapis.com/auth/calendar
```

Para que Google entregue refresh token debes incluir `access_type=offline` y normalmente `prompt=consent` en la autorización. Hazlo con OAuth Playground o con una herramienta OAuth local de confianza usando el cliente creado en el paso anterior. Guarda solo el `refresh_token`, no lo pegues en GitHub, chat, commits ni documentos.
7. En el VPS, edita únicamente `/opt/pancho-os-next/.env` y añade estas líneas con sus valores reales:

```dotenv
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REFRESH_TOKEN=...
# Opcional. Omite esta línea para usar el calendario principal de esa cuenta.
GOOGLE_CALENDAR_ID=primary
```

8. Reinicia solo el proceso activo después de editar el `.env`:

```bash
cd /opt/pancho-os-next
pm2 restart pancho-os-next --update-env
```

9. Nunca edites `/opt/pancho-os` ni reinicies el proceso legado `pancho-os` de puerto 4322. El dominio activo atiende el proceso `pancho-os-next` en puerto 4323.

## Parte 3: publicación y prueba real

Después de completar Parte 1, avisa a Codex con `migración Agenda aplicada`. Codex hará el commit, push a `master`, verificará el deploy automático y validará el endpoint productivo.

Después de Parte 2, abre `https://os.franciscoabad.com/agenda`:

1. Confirma que ves hoy, sábado, y mañana, domingo, aunque digan `Sin eventos`.
2. Crea un evento de prueba mañana a las 09:00 con etiqueta `prueba-agenda`.
3. Edita su título y añade una segunda etiqueta.
4. Presiona **Google Calendar**. Confirma el cambio cuando Hermes o MCP lo solicite.
5. Comprueba en Google Calendar que aparece a la hora de Ecuador y que el evento conserva las etiquetas en los metadatos privados del OS.
6. Elimina el evento desde el OS, sincroniza de nuevo y confirma que se cancela en Google.

## Decisión de seguridad pendiente

La sincronización implementada es bidireccional: puede crear, modificar y cancelar eventos en el calendario elegido. Cada sincronización invocada por MCP requiere confirmación. Falta la confirmación de Francisco sobre si el botón web también debe pedir una aprobación adicional antes de tocar Google, o si basta que el botón sea una acción manual iniciada por él.
