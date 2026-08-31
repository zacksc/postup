FROM node:20-slim

# Instala ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia apenas o server.js (sem dependências npm — usa só módulos nativos)
COPY services/video-render/server.js .

EXPOSE 3000

CMD ["node", "server.js"]