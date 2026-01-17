import pino, { transport } from "pino";

// In test environment, use simple console logging
const init_transport = (process.env.LOG_PRETTY === "false")
  ? undefined // Use default console transport
  : transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  });

export const logger = pino(init_transport);
