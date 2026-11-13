FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
RUN node -e "const value=process.argv[1]; if (!value || !(/^https?:\\/\\//.test(value) || value === '/api')) { console.error('VITE_API_URL must be an absolute API URL for Railway or /api for local Docker Compose'); process.exit(1); }" "$VITE_API_URL"
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
