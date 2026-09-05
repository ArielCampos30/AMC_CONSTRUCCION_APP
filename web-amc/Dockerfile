FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=4180
WORKDIR /app
COPY package.json server.mjs push.mjs features.mjs team.mjs quote-lifecycle.mjs fieldwork.mjs recovery.mjs closure.mjs planning.mjs postgres-db.mjs postgres-worker.mjs postgres-sql.mjs ./
RUN npm install --omit=dev
COPY public ./public
COPY private ./private
RUN mkdir /data && chown node:node /data
ENV AMC_DB_PATH=/data/amc.sqlite
USER node
VOLUME ["/data"]
EXPOSE 4180
CMD ["node","server.mjs"]
