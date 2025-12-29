# Stage 1: Build de la aplicación Angular
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package.json package-lock.json ./

# Instalar dependencias con cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Argumento para la URL del backend (con valor por defecto)
ARG API_URL=https://app.cursala.com.ar/api/v1

# Reemplazar la URL en el archivo de environment antes del build
RUN sed -i "s|https://app.cursala.com.ar/api/v1|${API_URL}|g" src/app/core/config/environment.prod.ts

# Build para producción (usa environment.prod.ts)
ENV NODE_ENV=production
RUN npm run build:prod

# Stage 2: Servidor Nginx para servir la aplicación
FROM nginx:alpine

# Copiar los archivos compilados desde el stage anterior
COPY --from=builder /app/dist/frontend-private/browser /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
