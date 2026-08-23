@echo off
title Pancho OS - Emulador Android
echo ==============================================
echo  Iniciando Emulador Android para Pancho OS...
echo ==============================================
start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd medium_phone
echo Listo! La ventana del emulador se abrira en unos segundos.
