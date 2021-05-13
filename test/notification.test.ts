import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
let supertest = require("supertest");
let request;
let token1 = "testuser1@gmail.com";
let token2 = "testuser2@gmail.com";
let token3 = "testuser3@gmail.com";
let token_anon = "anon@anon";
let user1, user2, user3;
let server;
let notification1, notification2;
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
const test_comment = {
  text: "some random reply comment",
};

beforeAll(async () => {
  process.env.MONGO_URI = "mongodb://localhost:27017/test";
  process.env.DEPLOY_ENV = "TEST";
  process.env.DEFAULT_COMMUNITY_ID = "609cb219daba822b65cbbd29";
  server = new Server(SERVER_PORT);

  try {
    await server.start();
    server.db.dropDatabase();
    request = supertest(server.app);
  } catch (e) {
    console.log(e);
  }

  user1 = (
    await request
      .post("/api/v1/user/signup")
      .set("Authorization", "Bearer " + token1)
      .send({ displayname: "testuser 1" })
  ).body;

  user2 = (
    await request
      .post("/api/v1/user/signup")
      .set("Authorization", "Bearer " + token2)
      .send({ displayname: "testuser 2" })
  ).body;
  user3 = (
    await request
      .post("/api/v1/user/signup")
      .set("Authorization", "Bearer " + token3)
      .send({ displayname: "testuser 3" })
  ).body;
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  server.stop();
});

const SERVER_PORT = 1338;

describe("Comment tests", () => {
  let post1, post2;
  let comment1;
  process.env.DEPLOY_ENV = "TEST";
  beforeAll(async () => {
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

  test("signed up user should recieve notification for comment on post ", async () => {
    let response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    response = await request
      .get(`/api/v1/notification`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body.data).toHaveLength(1);

    notification1 = response.body.data[0];
  });
  test("notifications can be marked as read", async () => {
    let response = await request
      .post(`/api/v1/notification/${notification1._id}/markRead`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/notification`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body.data).toHaveLength(0);
  });
  test("all notifications can be marked as read", async () => {
    let response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);

    response = await request
      .get(`/api/v1/notification`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body.data).toHaveLength(2);
    response = await request
      .post(`/api/v1/notification/markAllRead`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/notification`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body.data).toHaveLength(0);
  });
  test("all read notifications can also be fetched", async () => {
    let response = await request
      .get(`/api/v1/notification?all=true&limit=10&page=1`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body.data).toHaveLength(3);
  });
});
