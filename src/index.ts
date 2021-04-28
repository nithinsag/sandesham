import dotenv from "dotenv";
dotenv.config();
import { Server } from "./server";
import { consoleError } from "./helpers/utils";

const server = new Server(parseInt(process.env.SERVER_PORT as string));
server.start().then(
  () => {
    console.log("Server started successfully!");
  },
  (err) => {
    consoleError(err);
  }
);
