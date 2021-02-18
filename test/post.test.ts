import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
let supertest = require("supertest");
let request;
beforeAll(async () => {
  server = new Server(SERVER_PORT);

  try {
    await server.start();
    server.db.dropDatabase();
    console.log("started server");
    request = supertest(server.app);
  } catch (e) {
    console.log(e);
    console.log("failed to start server");
  }
});

afterAll(async () => {
  //   server.stop();
});

const SERVER_PORT = 1338;

test("server starts and / is accessible", async () => {
  expect(false).toBe(false);
});

it("gets the root endpoint", async () => {
  const response = await request.get("/");
  expect(response.status).toBe(200);
});

let server;
