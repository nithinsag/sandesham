import dotenv from "dotenv";
dotenv.config();
jest.setTimeout(30000);
import { Server } from "../src/server";
let supertest = require("supertest");
let server;
let user;
let request;
let token1 = "testuser1@gmail.com";
let token2 = "testuser2@gmail.com";
let token3 = "testuser3@gmail.com";

const sample_post_1 = {
  title: "Test Post 1",
  type: "text",
  slug: "sadaasdfvsadf",
  description: "discription for first post",
};

const sample_post_2 = {
  title: "Test Post 1",
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
    request = supertest(server.app);
  } catch (e) {
    console.log(e);
  }

  user = (
    await request
      .post("/api/v1/user/signup")
      .set("Authorization", "Bearer " + token1)
      .send({ displayname: "testuser 1" })
  ).body;

  await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token2)
    .send({ displayname: "testuser 2" });
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  server.stop();
});

const SERVER_PORT = 1338;

describe("User routes", () => {
  let post1, post2;
  process.env.DEPLOY_ENV = "TEST";

  test("register MessageToken route", async () => {
    const response = await request
      .post("/api/v1/user/registerMessageToken")
      .send({ pushMessageToken: "testtokenforpushmessage" })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });

  test("fetch user posts", async () => {
    let response = await request
      .post("/api/v1/post")
      .send(sample_post_1)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(201);
    post1 = response.body;

    response = await request
      .post("/api/v1/post")
      .send(sample_post_2)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    post2 = response.body;
    let user_id = user._id;
    response = await request.get(`/api/v1/user/${user_id}/posts`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });
  test("fetch user comments", async () => {
    let user_id = user._id;
    const response = await request.get(`/api/v1/user/${user_id}/comments`);
    expect(response.status).toBe(200);
  });
  test("logout user", async () => {
    const response = await request
      .post(`/api/v1/user/logout`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
});
