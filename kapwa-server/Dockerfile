FROM node:20-slim

# Install build tools for any native modules
RUN apt-get update && apt-get install -y python3 make g++ tzdata && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Manila
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
# No need to rebuild bcrypt separately; it will compile correctly with glibc
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]