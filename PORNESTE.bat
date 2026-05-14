@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   PharmaNET Pro v2.0 — ASE Bucuresti 2025       ║
echo  ║   MINCU Maria — Informatică Economică            ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Verifica Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [EROARE] Node.js nu este instalat!
    echo  Descarcati de la: https://nodejs.org
    pause
    exit /b 1
)
echo  [OK] Node.js detectat: 
node --version

:: Verifica psql
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [EROARE] PostgreSQL nu este in PATH!
    echo  Asigurati-va ca PostgreSQL este instalat si in PATH.
    pause
    exit /b 1
)
echo  [OK] PostgreSQL detectat

echo.
echo  [1/4] Initializare baza de date pharmanet...
psql -U postgres -f backend\setup.sql
if %errorlevel% neq 0 (
    echo  [EROARE] Initializare DB esuata!
    echo  Verificati ca PostgreSQL ruleaza si parola pentru postgres este corecta.
    pause
    exit /b 1
)
echo  [OK] Baza de date creata cu succes!

echo.
echo  [2/4] Instalare dependente backend...
cd backend
call npm install --prefer-offline 2>nul || call npm install
cd ..
echo  [OK] Backend gata

echo.
echo  [3/4] Instalare dependente frontend...
cd frontend
call npm install --prefer-offline 2>nul || call npm install
cd ..
echo  [OK] Frontend gata

echo.
echo  [4/4] Pornire aplicatie...
echo.
echo  ══════════════════════════════════════════════════
echo  Backend:   http://localhost:3001/api/health
echo  Frontend:  http://localhost:3000
echo.
echo  Conturi demo (parola: pharma123):
echo    admin@pharmanet.ro      — Admin Retea
echo    sef@pharmanet.ro        — Farmacist Sef
echo    farmacist@pharmanet.ro  — Farmacist
echo    manager@pharmanet.ro    — Manager Judet
echo    auditor@pharmanet.ro    — Auditor
echo  ══════════════════════════════════════════════════
echo.

start "PharmaNET Backend" cmd /k "cd backend && node src/app.js"
timeout /t 3 /nobreak >nul
start "PharmaNET Frontend" cmd /k "cd frontend && npm start"
timeout /t 8 /nobreak >nul
start http://localhost:3000
echo  Aplicatia porneste in browser...
