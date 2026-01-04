FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun db:gen

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

# Install CA certificates
RUN apk --no-cache add ca-certificates && update-ca-certificates

# Copy node_modules and built application
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
