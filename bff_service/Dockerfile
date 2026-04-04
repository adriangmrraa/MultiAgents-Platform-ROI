FROM node:22-alpine

WORKDIR /app

# Create app directory and set permissions for node user
RUN mkdir -p /app && chown -R node:node /app

# Copy package files as root
COPY --chown=node:node package*.json ./

# Switch to node user for npm install
USER node

# Install dependencies
RUN npm install

# Copy source code as node user
COPY --chown=node:node . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
