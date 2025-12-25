# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
# Relaxed install for stability
RUN npm install --legacy-peer-deps
COPY . .
# Build the app
RUN npm run build

# Stage 2: Serve
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
