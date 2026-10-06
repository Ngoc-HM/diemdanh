# Image chạy app y như trên server production (README → "Triển khai production"):
# npm ci → npm run build → mỗi lần start: npm run db → npm start.
FROM node:22-alpine

WORKDIR /app

# Cài cả devDependencies: `npm run db` cần tsx, `npm run build` cần tailwind.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# .env không nằm trong image. Lúc build Next nạp lib/db.ts, file này đòi có
# DATABASE_URL nhưng chưa kết nối, nên URL giả chỉ để qua bước build; khi chạy
# thì compose truyền URL thật từ .env.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/storage/uploads
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1

# Migrate + seed trước mỗi lần start (chạy lại bao nhiêu lần cũng không đổi gì).
CMD ["sh", "-c", "npm run db && exec npm start"]
