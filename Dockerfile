FROM oven/bun:1.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install

COPY . .

RUN apk --no-cache add libgcc libstdc++ ca-certificates openssl

RUN update-ca-certificates

RUN bun db:gen

RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile server \
  src/index.ts

FROM oven/bun:1.3-alpine AS runtime

WORKDIR /app

RUN apk --no-cache add libgcc libstdc++ ca-certificates openssl

RUN update-ca-certificates

EXPOSE 3000

CMD ["./server"]
