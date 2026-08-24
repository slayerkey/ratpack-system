@echo off
if /I "%~1"=="dev" (
  if "%~2"=="" (
    echo Usage: rat dev ^<slug^>
    exit /b 2
  )
  %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev.ps1" "%~2"
  exit /b %ERRORLEVEL%
)
%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat.ps1" %*
exit /b %ERRORLEVEL%
