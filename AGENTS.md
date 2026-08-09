# Handover para Codex / Otros Agentes

## Estado Actual de Pancho OS

El sistema ha sido migrado y desplegado exitosamente en el VPS de Hetzner (`178.105.163.120`).

### 1. Infraestructura y Despliegue
- **VPS**: El servidor está configurado con PM2 ejecutando la aplicación Node (`pancho-os`) en el puerto `4322`.
- **CI/CD**: Existe un pipeline de GitHub Actions (`.github/workflows/deploy.yml`) que hace deploy automático al VPS cada vez que se hace push a `master`. El VPS hace pull del repositorio, instala dependencias, compila y reinicia PM2 de forma desatendida.
- **Red/Dominio**: Caddy está configurado como reverse proxy apuntando el tráfico de `os.franciscoabad.com` al puerto `4322` con certificados SSL.
- **Autenticación Base**: El endpoint `/api/os-auth` usa `process.env.OS_PASSWORD` con un fallback por defecto (`pancho2026`), lo cual ya fue probado y funciona en producción para dar acceso inicial.

### 2. Problema Pendiente (Para Codex)
- **Error actual**: El frontend muestra un error "Legacy API keys are disabled" en los módulos de KPIs y Proyectos.
- **Causa**: Este error ocurre porque la API Key de Supabase (`SUPABASE_SERVICE_ROLE_KEY`) que estamos usando es legacy o inválida para el nuevo sistema de Supabase. Al parecer la key extraída del archivo local `.txt` ya no es válida o está deshabilitada en el proyecto de Supabase.
- **Solución requerida**: Codex debe actualizar la clave `SUPABASE_SERVICE_ROLE_KEY` (y asegurar que `SUPABASE_URL` esté correcta) en el archivo `.env` o a través de los secretos de GitHub Actions (si se inyectan en el VPS) o editando el archivo `/opt/pancho-os/.env` directamente en el VPS (y reiniciar PM2 con `pm2 restart pancho-os`).

Una vez corregidas las credenciales de Supabase, los paneles de "KPIs" y "Proyectos" cargarán la información correctamente en `os.franciscoabad.com`.
