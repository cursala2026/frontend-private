# Stage 1: Build de la aplicación Angular
FROM node:24-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Build de producción
RUN npm run build

# Stage 2: Servidor Nginx para servir la aplicación
FROM nginx:alpine

# Copiar los archivos compilados desde el stage anterior
COPY --from=builder /app/dist/frontend-private /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
