FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
# Note: db:gen and build need to happen in the build stage
RUN bun db:gen
RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile server \
  src/index.ts

FROM alpine:3.19 AS runtime
WORKDIR /app
# Install only the bare essentials for the compiled binary
RUN apk --no-cache add libgcc libstdc++ ca-certificates
RUN update-ca-certificates

# Explicitly point to the CA bundle
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY --from=build /app/server /app/server

EXPOSE 3000
CMD ["./server"]