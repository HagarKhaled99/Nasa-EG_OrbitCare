# ORBIT TWIN as one container (website + crew API + SQLite). Used by the Hugging Face Space (sdk: docker).
# Local test, if Docker is installed:  docker build -t orbit-twin .  &&  docker run -p 7860:7860 orbit-twin
FROM node:22-slim

WORKDIR /app

# Dependencies first (cached between builds), dev dependencies included because the build needs Vite + TypeScript.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Hugging Face serves the Space on port 7860 and runs the container as a non-root user, so the database
# and session secret live in /tmp (writable). The database starts fresh from the SYNTHETIC_DEMO dataset.
ENV NODE_ENV=production \
    PORT=7860 \
    ORBIT_DB_PATH=/tmp/orbit-twin/orbit-twin.db \
    ORBIT_COOKIE_SAMESITE=None

EXPOSE 7860
CMD ["node", "--no-warnings", "scripts/serve.mjs"]
