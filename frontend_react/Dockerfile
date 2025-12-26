# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Relaxed install for stability
RUN npm install --legacy-peer-deps
COPY . .
# Build the app with environment variables from Easypanel
ARG VITE_ADMIN_TOKEN
ARG VITE_API_BASE_URL
ENV VITE_ADMIN_TOKEN=$VITE_ADMIN_TOKEN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: Serve
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
