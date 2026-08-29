# Redes sociales en Pancho OS

## Estado actual

La pantalla `/redes` ya está desplegada y consume `/api/redes-metricas?dias=30`.
El endpoint devuelve tarjetas para Instagram, Facebook, TikTok, LinkedIn, YouTube y X, además de los diez posts con más interacciones.
En producción, al 29 de agosto de 2026, la respuesta es válida pero está vacía: `{"plataformas":{},"posts_top":[]}`.

Esto significa que falta la ingesta de datos de cada proveedor. No hay OAuth automático implementado todavía. La API de Pancho OS acepta métricas normalizadas por `POST /api/redes-metricas` y hace upsert por plataforma y fecha.

## Contrato de ingesta

Enviar con autenticación de OS y `Content-Type: application/json`:

```json
{
  "plataforma": "instagram",
  "fecha": "2026-08-29",
  "seguidores": 1234,
  "alcance": 9876,
  "impresiones": 12000,
  "interacciones": 456,
  "publicaciones": 8,
  "engagement_rate": 3.7,
  "raw": {"provider": "meta"},
  "posts": [
    {
      "post_id": "abc123",
      "url": "https://www.instagram.com/p/abc123/",
      "titulo": "Post de ejemplo",
      "publicado_at": "2026-08-28T15:00:00Z",
      "alcance": 1000,
      "impresiones": 1200,
      "likes": 80,
      "comentarios": 4,
      "compartidos": 3,
      "guardados": 10
    }
  ]
}
```

La carga es idempotente: repetir la misma fecha y `post_id` actualiza la fila, no duplica datos.

## Paso común para cualquier red

1. Crear la credencial oficial en el portal del proveedor y conceder sólo lectura de analíticas.
2. Guardar el secreto en el job de ingesta, nunca en el frontend, Supabase ni el repositorio.
3. Consultar la cuenta y las métricas del día anterior, usando la zona horaria de la cuenta.
4. Transformar la respuesta al contrato anterior.
5. Hacer `POST /api/redes-metricas` una vez por plataforma y fecha.
6. Revisar `/redes` y confirmar tarjeta, serie de seguidores y top posts.
7. Programar la ingesta diaria después de medianoche de la cuenta. Si el proveedor tiene datos con retraso, usar una ventana móvil de siete días para corregir cifras.

## Instagram y Facebook, Meta Graph API

1. En Meta for Developers crear o seleccionar una app de tipo Business.
2. Añadir Instagram Graph API y Facebook Graph API.
3. Vincular la cuenta de Instagram profesional a una Página de Facebook.
4. Solicitar permisos de lectura de insights de la Página y de la cuenta profesional de Instagram. Para producción, completar App Review.
5. Generar un token de larga duración para un usuario del Business Manager y resolver los IDs de Página e Instagram.
6. Para cada fecha, leer seguidores, alcance, impresiones e interacciones de los endpoints de insights de la cuenta y de cada publicación.
7. Enviar dos payloads, uno con `plataforma: "instagram"` y otro con `plataforma: "facebook"`.
8. Renovar el token antes de su expiración y revocarlo si se cambia la persona administradora.

## TikTok

1. Crear una app en TikTok for Developers y habilitar TikTok for Business o la API de Content Marketing disponible para la cuenta.
2. Completar el registro de negocio y la revisión de permisos que exija TikTok.
3. Autorizar la cuenta publicitaria o de creador con los scopes de lectura de estadísticas.
4. Obtener seguidores, visualizaciones, alcance e interacciones de la cuenta y de los videos publicados.
5. Mapear el ID permanente del video a `posts[].post_id` y guardar su URL pública.
6. Enviar el payload con `plataforma: "tiktok"`.
7. Controlar límites de cuota y reintentar con backoff; TikTok puede entregar métricas agregadas con demora.

## LinkedIn

1. Crear una app en LinkedIn Developers y asociarla a la Página de empresa correcta.
2. Solicitar acceso a las APIs de organizaciones y analíticas de página. La aprobación de LinkedIn es necesaria para producción.
3. Implementar OAuth 2.0 Authorization Code y guardar refresh token cifrado en el job, no en el navegador.
4. Consultar seguidores, visitantes, impresiones, clics, reacciones, comentarios y compartidos de la página.
5. Consultar posts de la página dentro de los últimos 30 días y mapear sus IDs y URLs.
6. Enviar `plataforma: "linkedin"`.
7. Renovar el access token cuando corresponda y registrar errores 401 como alerta operativa.

## YouTube

1. En Google Cloud crear o seleccionar un proyecto y habilitar YouTube Data API v3 y YouTube Analytics API.
2. Crear OAuth 2.0 para la cuenta propietaria del canal y autorizar sólo lectura.
3. Guardar refresh token en el job de ingesta.
4. Consultar suscriptores, visualizaciones, alcance disponible e interacciones del canal.
5. Consultar videos publicados en los últimos 30 días y sus likes, comentarios y visualizaciones.
6. Enviar `plataforma: "youtube"`. Usar el ID del video como `post_id` y la URL `https://www.youtube.com/watch?v=...`.
7. Vigilar cuota de YouTube; `search.list` es caro y no debe usarse para la ingesta diaria si ya se conocen los IDs.

## X

1. Crear un proyecto y una app en the X Developer Portal.
2. Habilitar OAuth 2.0 con PKCE y scopes de lectura de usuario y posts.
3. Verificar que el plan contratado incluya las métricas de usuario y de posts necesarias.
4. Consultar seguidores, impresiones, likes, respuestas y reposts de la cuenta y de los posts recientes.
5. Enviar `plataforma: "x"`, usando el ID del post y su URL `https://x.com/...`.
6. Respetar límites de cuota y tratar un 403 de plan insuficiente como estado de configuración, no como fallo de la app.

## Validación final

Después de conectar una red:

1. Confirmar que el POST responde `201` y devuelve `metrica`.
2. Repetir el mismo POST y confirmar que no crea una segunda fila.
3. Abrir `/redes`; la tarjeta debe pasar de `Sin conectar` a `En vivo`.
4. Confirmar que el cambio de seguidores compara contra el punto de hace aproximadamente siete días.
5. Abrir un top post y comprobar que el enlace sólo permite `http` o `https`.
6. Si no hay datos, revisar primero credencial, zona horaria, fecha consultada y permisos del proveedor.

## Lo que aún requiere una siguiente implementación

La pantalla y el contrato están listos, pero todavía falta un worker OAuth/ingesta para automatizar estos pasos. Ese worker puede vivir en GitHub Actions, n8n o el VPS. La opción más segura para Pancho OS es un job backend con secretos del proveedor y una ejecución diaria, manteniendo `/api/redes-metricas` como único punto de escritura.
