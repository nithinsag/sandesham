import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
let supertest = require("supertest");
let request;
beforeAll(async () => {
  process.env.MONGO_URI = "mongodb://localhost:27017/test";
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
  server.stop();
});

const SERVER_PORT = 1338;

it("gets the root endpoint", async () => {
  const response = await request.get("/");
  expect(response.status).toBe(200);
});

it("gets the popular feed  endpoint", async () => {
  const response = await request.get("/api/v1/post/popular");
  expect(response.status).toBe(200);
});
it("can't create new post without authentication", async () => {
  const response = await request.post("/api/v1/post");
  expect(response.status).toBe(400);
});

let server;
