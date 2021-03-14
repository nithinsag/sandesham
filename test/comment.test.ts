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
const test_comment = {
  text: "some random reply comment",
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

  test("signed up user can create comment on a post ", async () => {
    let response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
  });

  test("signed up user can create comment on a comment ", async () => {
    let response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);

    response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, parent: response.body._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);

    let parent = response.body._id;
    for (let i = 4; i > 0; i--) {
      response = await request
        .post(`/api/v1/comment`)
        .send({ post: post1._id, parent: parent, ...test_comment })
        .set("Authorization", "Bearer " + token2);
      expect(response.status).toBe(201);
      parent = response.body._id;
    }
  });

  test("comment can be upvoted ", async () => {
    let response = await request
      .post(`/api/v1/comment`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    let comment = response.body;

    response = await request
      .post(`/api/v1/comment/${comment._id}/vote/1`)
      .send({ post: post1._id, ...test_comment })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("comment tree for a post can be retrieved ", async () => {
    let response = await request
      .get(`/api/v1/post/${post1._id}/comments`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    let comments = response.body;
    expect(comments).toHaveLength(3);

    let container: any = [];
    comments.forEach((comment) => {
      container.push(comment);
      flattenCommentTree(comment);
    });
    function flattenCommentTree(comment) {
      comment.replies.forEach((reply) => {
        container.push(reply);
        flattenCommentTree(reply);
      });
    }

    expect(container).toHaveLength(8);
  });
});
