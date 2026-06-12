@echo off
REM Démarre le serveur backend BudgetHub Family (port 3000).
REM Double-cliquez sur ce fichier et laissez la fenêtre ouverte pendant l'utilisation du site.
cd /d "%~dp0backend"
"C:\Program Files\nodejs\node.exe" server.js
pause
