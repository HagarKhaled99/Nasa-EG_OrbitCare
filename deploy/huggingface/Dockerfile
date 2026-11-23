# ORBIT TWIN on a Hugging Face Space (SDK: Docker). Paste this file into the Space as "Dockerfile".
# It downloads the public GitHub repository, builds the app and serves website + crew API + SQLite on port 7860.
# New code on GitHub → Space Settings → "Factory rebuild".
FROM node:22

WORKDIR /app
RUN git clone --depth 1 https://github.com/HagarKhaled99/Nasa-EG_OrbitCare.git . \
 && npm ci --include=dev \
 && npm run build

# Hugging Face runs the container as a non-root user: the database and session secret live in /tmp (writable).
# SameSite=None so sign-in also works inside the Space page's frame.
ENV NODE_ENV=production \
    PORT=7860 \
    ORBIT_DB_PATH=/tmp/orbit-twin/orbit-twin.db \
    ORBIT_COOKIE_SAMESITE=None

EXPOSE 7860
CMD ["node", "--no-warnings", "scripts/serve.mjs"]
