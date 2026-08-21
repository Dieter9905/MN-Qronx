FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --omit=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy source
COPY . .

EXPOSE 10000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run seed && node src/server.js"]
