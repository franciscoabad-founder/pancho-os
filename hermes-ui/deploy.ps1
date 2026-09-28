# Despliega hermes-ui en el VPS: compila en esta PC (el VPS tiene poca RAM)
# desde el commit que corre el backend, sube el build y reinicia el servicio.
# Uso: powershell -File C:\DEV\Pancho-OS\hermes-ui\deploy.ps1 [-Credenciales]
#   -Credenciales: (re)escribe /etc/hermes-ui.env desde la boveda, sin imprimirla.
# Nunca actualiza Hermes ni toca otros servicios. Anota el cambio en /root/CAMBIOS.md.
param([switch]$Credenciales)
$ErrorActionPreference = 'Stop'
# Sin BOM: PowerShell 5.1 lo antepone al texto que se pasa por tuberia a ssh.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
$vps = 'root@178.105.163.120'
$here = $PSScriptRoot
$work = Join-Path $here '.work'
$vault = 'C:\Users\Francisco\OneDrive\Vault\hermes dashboard vps.txt'

# 1. Commit del backend: el build debe coincidir o la API no calza.
$version = ssh -o BatchMode=yes $vps 'hermes --version 2>/dev/null | head -1'
if ($version -notmatch '\.g([0-9a-f]{7,})') { throw "No pude leer el commit del VPS: $version" }
$commit = $Matches[1]
Write-Host "Backend en $commit"

# 2. Build oculto.
$p = Start-Process node -ArgumentList "`"$here\build.mjs`"", '--commit', $commit -WindowStyle Hidden -Wait -PassThru `
  -RedirectStandardOutput "$here\build.log" -RedirectStandardError "$here\build.log.err"
if ($p.ExitCode -ne 0) { throw "Build fallo, ver $here\build.log.err" }

# 3. Paquete: server.mjs + dist.
$pkg = Join-Path $work 'pkg'
if (Test-Path $pkg) { Remove-Item -Recurse -Force $pkg }
New-Item -ItemType Directory $pkg | Out-Null
Copy-Item "$here\server.mjs" $pkg
Copy-Item "$work\dist" "$pkg\dist" -Recurse
$tgz = Join-Path $work 'hermes-ui.tgz'
tar -czf $tgz -C $pkg .
scp -q $tgz "${vps}:/tmp/hermes-ui.tgz"
scp -q "$here\hermes-ui.service" "${vps}:/tmp/hermes-ui.service"

# 4. Credenciales del dashboard (solo si faltan o se piden).
$tiene = ssh $vps 'test -s /etc/hermes-ui.env && echo si || echo no'
if ($Credenciales -or $tiene -ne 'si') {
  $lineas = Get-Content $vault
  $pick = { param($k) (($lineas | Where-Object { $_ -match "^$k\s*:" } | Select-Object -First 1) -split ':', 2)[1].Trim() }
  $q = { param($v) '"' + ($v -replace '\\', '\\' -replace '"', '\"') + '"' }
  $envFile = "HERMES_UI_USER=$(& $q (& $pick 'Usuario'))`nHERMES_UI_PASS=$(& $q (& $pick 'Clave'))`n"
  $envFile | ssh $vps "umask 077; sed '1s/^\xEF\xBB\xBF//' | tr -d '\r' > /etc/hermes-ui.env"
  Write-Host 'Credenciales escritas en /etc/hermes-ui.env (600)'
}

# 5. Instalar release, servicio y regla de firewall (solo interfaz Tailscale).
$remoto = @"
set -e
rel=/opt/hermes-ui/releases/$commit-`$(date +%Y%m%d%H%M%S)
mkdir -p `$rel && tar -xzf /tmp/hermes-ui.tgz -C `$rel && rm /tmp/hermes-ui.tgz
ln -sfn `$rel /opt/hermes-ui/current
install -m 644 /tmp/hermes-ui.service /etc/systemd/system/hermes-ui.service && rm /tmp/hermes-ui.service
systemctl daemon-reload
systemctl enable hermes-ui.service >/dev/null 2>&1
systemctl restart hermes-ui.service
ufw status | grep -q '9120/tcp on tailscale0' || ufw allow in on tailscale0 to any port 9120 proto tcp comment 'hermes-ui Pancho OS solo Tailscale' >/dev/null
ls -1dt /opt/hermes-ui/releases/* | tail -n +4 | xargs -r rm -rf
echo "- `$(date -u '+%Y-%m-%d %H:%M') [claude-pancho-os] hermes-ui desplegado (build $commit, release `$rel). Servicio hermes-ui.service en 100.127.42.51:9120, solo Tailscale, ufw tailscale0 9120. Rollback: systemctl disable --now hermes-ui." >> /root/CAMBIOS.md
sleep 3
curl -fsS http://100.127.42.51:9120/healthz
"@
$remoto | ssh $vps "sed '1s/^\xEF\xBB\xBF//' | tr -d '\r' | bash -s"
if ($LASTEXITCODE -ne 0) { throw 'El despliegue remoto fallo' }
Write-Host "`nListo: http://100.127.42.51:9120 (solo con Tailscale)"
