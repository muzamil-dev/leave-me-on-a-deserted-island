FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV DISPLAY=:99

# Use a shell script to start xvfb and the app
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1920x1080x24 & \nsleep 2\nnode dist/index.js' > /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
