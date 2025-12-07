#!/bin/bash

# Script para iniciar el entorno de desarrollo local
# Este script inicia tanto el backend como el frontend

set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando entorno de desarrollo Cursala...${NC}\n"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Debes ejecutar este script desde la carpeta frontend-private${NC}"
    exit 1
fi

# Verificar que existe el backend
if [ ! -d "../backend" ]; then
    echo -e "${RED}❌ Error: No se encuentra la carpeta ../backend${NC}"
    exit 1
fi

# Verificar que MongoDB está corriendo
echo -e "${YELLOW}🔍 Verificando MongoDB...${NC}"
if ! pgrep -x mongod > /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB no está corriendo. Intentando iniciar...${NC}"
    if command -v systemctl &> /dev/null; then
        sudo systemctl start mongod
        echo -e "${GREEN}✓ MongoDB iniciado${NC}"
    else
        echo -e "${RED}❌ No se pudo iniciar MongoDB automáticamente. Por favor, inícialo manualmente.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ MongoDB está corriendo${NC}"
fi

# Función para matar procesos al salir
cleanup() {
    echo -e "\n${YELLOW}🛑 Deteniendo servidores...${NC}"
    kill $(jobs -p) 2>/dev/null
    echo -e "${GREEN}✓ Servidores detenidos${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar backend
echo -e "\n${BLUE}📦 Iniciando backend...${NC}"
cd ../backend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Instalando dependencias del backend...${NC}"
    npm install
fi
npm start &
BACKEND_PID=$!
cd ../frontend-private

# Esperar a que el backend esté listo
echo -e "${YELLOW}⏳ Esperando a que el backend esté listo...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8080/api/v1 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend está listo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ El backend no respondió después de 30 segundos${NC}"
        kill $BACKEND_PID
        exit 1
    fi
    sleep 1
done

# Iniciar frontend
echo -e "\n${BLUE}🎨 Iniciando frontend Angular...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Instalando dependencias del frontend...${NC}"
    npm install
fi
npm start &
FRONTEND_PID=$!

# Esperar a que el frontend esté listo
echo -e "${YELLOW}⏳ Esperando a que el frontend esté listo...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:4200 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend está listo${NC}"
        break
    fi
    sleep 1
done

# Mostrar información
echo -e "\n${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ ¡Entorno de desarrollo listo!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e ""
echo -e "  ${BLUE}Backend:${NC}   http://localhost:8080/api/v1"
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:4200"
echo -e ""
echo -e "${YELLOW}Presiona Ctrl+C para detener ambos servidores${NC}"
echo -e ""

# Esperar a que los procesos terminen
wait
