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

FROM alpine:latest AS runtime

WORKDIR /app

RUN apk --no-cache add libgcc libstdc++

COPY --from=build /app/server ./

EXPOSE 3000

CMD ["./server"]
