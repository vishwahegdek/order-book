# Base image
FROM node:20-alpine

# Working directory
WORKDIR /app

# Install dependencies (cache optimized)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Environment defaults
ENV PORT=3000
EXPOSE 3000

# Start application
CMD ["npm", "start"]
