# Consola web eWMS: build de producción servido por nginx con el contrato de despliegue.
# Ver vault: 0029 - Despliegue de la consola con nginx.

# Etapa 1: build de producción (dist/shell/browser) y cabeceras de nginx desde el contrato
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Sin scripts de instalación: `prepare` configura los hooks de git, que la imagen no tiene.
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run build \
 && node tools/deploy/nginx-headers.mjs /app/security-headers.conf

# Etapa 2: nginx sirve los estáticos y pasa /api/v1/security/* a la API
FROM nginx:1.29-alpine
ENV API_UPSTREAM=http://wms_advanced_api_sqlserver:8080
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/shell/browser /usr/share/nginx/html
EXPOSE 8080
