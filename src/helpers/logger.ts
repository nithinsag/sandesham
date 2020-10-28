import winston from "winston";

// creates a new Winston Logger
let winstonLogger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.json(),
    winston.format.prettyPrint()
  ),
});

export const logger = {
  info: (message: string) => winstonLogger.log("info", message),
  debug: (message: string) => winstonLogger.log("debug", message),
};
