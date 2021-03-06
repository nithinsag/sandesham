import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
let supertest = require("supertest");
let request;
let token1 = "testuser1@gmail.com";
let token2 = "testuser2@gmail.com";
let token3 = "testuser3@gmail.com";
let server;

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

  await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token1)
    .send({ displayname: "testuser 1" });

  await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token2)
    .send({ displayname: "testuser 2" });
  await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token2)
    .send({ displayname: "testuser 3" });
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  server.stop();
});

const SERVER_PORT = 1338;

describe("Post routes", () => {
  let post1, post2;
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
  });

  test("signed up user can upvote ", async () => {
    let response = await request
      .post(`/api/v1/post/${post1._id}/vote/1`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("signed up user1 can report ", async () => {
    let response = await request
      .post(`/api/v1/post/${post1._id}/report`)
      .send({ reason: "explicit content" })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("signed up user2 can report", async () => {
    let response = await request
      .post(`/api/v1/post/${post1._id}/report`)
      .send({ reason: "explicit content" })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("should be able to fetch popular feed", async () => {
    let response = await request.get(`/api/v1/post/popular`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test("should be able to fetch popular feed with pagination for anonymous user", async () => {
    let response = await request.get(`/api/v1/post/popular?limit=1&page=1`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userVote).toBe(0);
  });

  test("signed up user can upvote", async () => {
    let response = await request
      .post(`/api/v1/post/${post2._id}/vote/1`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("upvoted post to be shown in feed and sort to be working", async () => {
    let response = await request.get(`/api/v1/post/popular`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]._id).toBe(post2._id);
    expect(response.body.data[0].userVote).toBe(0);
  });

  test("upvoted post to be shown in feed and sort to be working with upvotes showing", async () => {
    let response = await request
      .get(`/api/v1/post/popular?limit=1&page=1`)
      .set("Authorization", "Bearer " + token2);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]._id).toBe(post2._id);
    expect(response.body.data[0].userVote).toBe(1);
  });

  test("signed up user can downvote", async () => {
    let response = await request
      .post(`/api/v1/post/${post2._id}/vote/-1`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("down voted post to be shown in feed and sort to be working with upvotes showing", async () => {
    let response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token1);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    expect(response.body.data[0]._id).toBe(post1._id);
    expect(response.body.data[0].userVote).toBe(0);
    console.log(response.data);
    expect(response.body.data[1]._id).toBe(post2._id);
    expect(response.body.data[1].userVote).toBe(-1);
  });
});
