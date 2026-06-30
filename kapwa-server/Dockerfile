FROM node:20-slim

# Install build tools for any native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
# No need to rebuild bcrypt separately; it will compile correctly with glibc
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]