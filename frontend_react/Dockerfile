# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Relaxed install for stability
RUN npm install --legacy-peer-deps
COPY . .
# Build the app with environment variables from Easypanel
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Meta SDK - Build Time Variables (supports both VITE_FACEBOOK_APP_ID and VITE_META_APP_ID)
ARG VITE_FACEBOOK_APP_ID
ARG VITE_META_APP_ID
ARG VITE_FACEBOOK_API_VERSION
ARG VITE_META_CONFIG_ID
ARG VITE_META_EMBEDDED_SIGNUP
ENV VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID:-$VITE_META_APP_ID}
ENV VITE_META_APP_ID=${VITE_META_APP_ID:-$VITE_FACEBOOK_APP_ID}
ENV VITE_FACEBOOK_API_VERSION=$VITE_FACEBOOK_API_VERSION
ENV VITE_META_CONFIG_ID=$VITE_META_CONFIG_ID
ENV VITE_META_EMBEDDED_SIGNUP=$VITE_META_EMBEDDED_SIGNUP

# Google OAuth - Build Time Variable
ARG VITE_GOOGLE_OAUTH_CLIENT_ID
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=$VITE_GOOGLE_OAUTH_CLIENT_ID

RUN npm run build

# Stage 2: Serve
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]
