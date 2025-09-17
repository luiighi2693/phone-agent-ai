@echo off
echo 🚀 Iniciando entorno local del agente telefónico...

echo.
echo 📦 Instalando dependencias...
call npm install

echo.
echo 🏢 Iniciando simulador ERP...
cd erp-simulator
call npm install
start /B npm start
cd ..

echo.
echo ⏳ Esperando que el ERP esté listo...
timeout /t 3 /nobreak > nul

echo.
echo 🔧 Compilando Azure Functions...
call npm run build

echo.
echo 🧪 Ejecutando pruebas...
node test-local.js

echo.
echo 📞 Iniciando Azure Functions...
echo Presiona Ctrl+C para detener
call npm start