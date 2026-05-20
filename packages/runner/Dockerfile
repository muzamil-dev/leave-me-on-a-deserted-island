FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Playwright needs some extra environment variables for stealth
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

CMD ["node", "dist/index.js"]
