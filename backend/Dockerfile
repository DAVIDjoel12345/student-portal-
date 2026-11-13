FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node backend/ ./
COPY --chown=node:node database/ /database/
USER node
EXPOSE 5000
CMD ["node", "server.js"]
