import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
let supertest = require("supertest");
let request;
let token = "testuser@gmail.com";
let server;

const sample_post = {
  title: "sdfasdfadasdfgdfg  asdfasd asdf",
  type: "text",
  slug: "sadaasdfvsadf",
  description: "discription for first post",
};

beforeAll(async () => {
  process.env.MONGO_URI = "mongodb://localhost:27017/test";
  process.env.DEPLOY_ENV = "TEST";
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

  let { body } = await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token)
    .send({ displayname: "testuser" });

  console.log(body);
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  server.stop();
});

const SERVER_PORT = 1338;

describe("Post routes", () => {
  process.env.DEPLOY_ENV = "TEST";

  test("gets the root endpoint", async () => {
    const response = await request.get("/");
    expect(response.status).toBe(200);
  });

  test("gets the popular feed  endpoint", async () => {
    const response = await request.get("/api/v1/post/popular");
    expect(response.status).toBe(200);
  });

  test("can't create new post without authentication", async () => {
    const response = await request.post("/api/v1/post");
    expect(response.status).toBe(400);
  });

  test("signed up user can create posts ", async () => {
    let response = await request
      .post("/api/v1/post")
      .send(sample_post)
      .set("Authorization", "Bearer " + token);
    expect(response.status).toBe(201);
    console.log(response.body);
  });
});
