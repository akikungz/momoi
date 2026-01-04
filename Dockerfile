FROM oven/bun:1.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install

COPY . .

RUN bun db:gen

RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile server \
  src/index.ts

FROM alpine:3.23 AS runtime

WORKDIR /app

RUN apk --no-cache add libgcc libstdc++ ca-certificates openssl

RUN update-ca-certificates

ENV BUN_TLS_CA_FILE=/etc/ssl/certs/ca-certificates.crt

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_DIR=/etc/ssl/certs

COPY --from=build /app/server ./

EXPOSE 3000

CMD ["./server"]
