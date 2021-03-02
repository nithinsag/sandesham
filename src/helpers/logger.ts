import winston from "winston";

let log_level = process.env.LOG_LEVEL || "error";
// creates a new Winston Logger
let winstonLogger = winston.createLogger({
  transports: [new winston.transports.Console({ level: log_level })],
  format: winston.format.combine(
    winston.format.json(),
    winston.format.prettyPrint()
  ),
});

export const logger = {
  info: (message: string) => winstonLogger.log("info", message),
  debug: (message: string) => winstonLogger.log("debug", message),
};
