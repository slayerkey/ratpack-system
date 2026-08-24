@echo off
setlocal

set "_RAT_NEEDS_BOOTSTRAP="
for %%A in (dev ship submit stage kit ship-cloud kit-cloud) do (
  if /I "%~1"=="%%A" set "_RAT_NEEDS_BOOTSTRAP=1"
)

if defined _RAT_NEEDS_BOOTSTRAP if not defined RATPACK_BOOTSTRAPPED (
  if not exist "%~dp0tools\local\rat-bootstrap.ps1" (
    echo RatPack bootstrap helper is not installed. Run: rat main
    exit /b 1
  )
  %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-bootstrap.ps1"
  if errorlevel 1 exit /b 1
  set "RATPACK_BOOTSTRAPPED=1"
  call "%~f0" %*
  exit /b %ERRORLEVEL%
)

if /I "%~1"=="dev" (
  if "%~2"=="" (
    echo Usage: rat dev ^<slug^>
    exit /b 2
  )
  if exist "%~dp0tools\local\rat-dev-preflight.ps1" (
    %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev-preflight.ps1" "%~2"
    if errorlevel 1 (
      if exist "%~dp0tools\local\rat-dev-open.ps1" (
        %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev-open.ps1" "%~2" >nul 2>&1
      )
      exit /b 1
    )
  )
  %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev.ps1" "%~2"
  if errorlevel 1 (
    echo.
    echo Rat Dev failed.
    if exist "%~dp0tools\local\rat-dev-open.ps1" (
      echo Opening the local development folder for inspection...
      %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev-open.ps1" "%~2"
    )
    exit /b 1
  )
  exit /b 0
)
if /I "%~1"=="dev-open" (
  if "%~2"=="" (
    echo Usage: rat dev-open ^<slug^>
    exit /b 2
  )
  if not exist "%~dp0tools\local\rat-dev-open.ps1" (
    echo Rat Dev open helper is not installed.
    exit /b 1
  )
  %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat-dev-open.ps1" "%~2"
  if errorlevel 1 exit /b 1
  exit /b 0
)
%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\rat.ps1" %*
exit /b %ERRORLEVEL%
