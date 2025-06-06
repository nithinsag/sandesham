import dotenv from "dotenv";
dotenv.config();
import { Server } from "../src/server";
import { createNotification } from "../src/asyncJobs";

let supertest = require("supertest");
let request;
let token1 = "testuser1@gmail.com";
let token2 = "testuser2@gmail.com";
let token3 = "testuser3@gmail.com";
let token_anon = "anon_user3@anon";
let user1, user2;
let server;

const sample_post_1 = {
  title: "Test Post 1",
  type: "text",
  tags: ["cricket"],
  slug: "sadaasdfvsadf",
  description: "discription for first post",
};

const sample_post_2 = {
  title: "Test Post 1",
  type: "text",
  tags: ["football"],
  slug: "sadaasdfvsadf",
  description: "discription for first post",
};

const sample_post_link = {
  title: "Test Post 1",
  type: "link",
  link: "http://news.ycombinator.com",
  slug: "sadaasdfvsadf",
  description: "discription for first post",
};

beforeAll(async () => {
  // let mockedaddJobs = addJobs as jest.Mock;
  // mockedaddJobs.mockResolvedValue({});
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

  let response = await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token1)
    .send({ displayname: "testuser 1" });
  user1 = response.body;

  response = await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token2)
    .send({ displayname: "testuser 2" });
  user2 = response.body;
  await request
    .post("/api/v1/user/signup")
    .set("Authorization", "Bearer " + token3)
    .send({ displayname: "testuser 3" });
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  if (server) server.stop();
});

const SERVER_PORT = 1338;

describe("Post routes", () => {
  let post1, post2;
  process.env.DEPLOY_ENV = "TEST";
  process.env.DEFAULT_COMMUNITY_ID = "609cb219daba822b65cbbd29";

  test("gets the root endpoint", async () => {
    const response = await request.get("/");
    expect(response.status).toBe(200);
  });
  test("gets the popular feed  endpoint", async () => {
    let response = await request.get("/api/v1/post/popular");
    expect(response.status).toBe(401);
    response = await request
      .get("/api/v1/post/popular")
      .set("Authorization", "Bearer " + token_anon);
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
    expect(post1.voteCount).toBe(1);

    response = await request
      .post("/api/v1/post")
      .send(sample_post_2)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    post2 = response.body;
  });

  test("anonymous user can fetch posts ", async () => {
    let response = await request
      .get("/api/v1/post")
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    post1 = response.body[0];

    response = await request
      .get(`/api/v1/post/${post1._id}`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
  });

  test("authorized user can fetch posts ", async () => {
    let response = await request
      .get("/api/v1/post")
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    post1 = response.body[0];

    response = await request
      .get(`/api/v1/post/${post1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test.skip("link type posts will auto add open graph data", async () => {
    let response = await request
      .post("/api/v1/post")
      .send(sample_post_link)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("ogData");
  });

  test("signed up user can report ", async () => {
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

  test("reported posts are hidden from feed for users", async () => {
    let response = await request
      .post(`/api/v1/post/${post1._id}/report`)
      .send({ reason: "explicit content" })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });

  test("should be able to fetch popular feed", async () => {
    let response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });
  test("reported posts are hidden from feed for users", async () => {
    let response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  test("should be able to fetch popular feed with pagination for anonymous user", async () => {
    let response = await request
      .get(`/api/v1/post/popular?limit=1&page=1`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userVote).toBeUndefined();
  });

  test("signed up user can upvote", async () => {
    let response = await request
      .post(`/api/v1/post/${post2._id}/vote/1`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });

  test("upvoted post to be shown in feed and sort to be working", async () => {
    let response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]._id).toBe(post2._id);
    expect(response.body.data[0].userVote).toBeUndefined();
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
    expect(response.body.data[0].userVote).toBe(1);
    expect(response.body.data[1]._id).toBe(post2._id);
    expect(response.body.data[1].userVote).toBe(-1);
  });
  test("posts can be created with tags and filtered with tags", async () => {
    let response = await request
      .post("/api/v1/post")
      .send({ ...sample_post_1, tags: ["test_tag", "cricket"] })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(201);
    post1 = response.body;
    response = await request
      .get(`/api/v1/post/popular?tag=test_tag`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]._id).toBe(post1._id);
  });

  test("most popular tags can be fetched", async () => {
    let response = await request
      .get("/api/v1/tags")
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
  });

  test("post cannot be deleted by others", async () => {
    let response = await request
      .delete(`/api/v1/post/${post2._id}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(401);
  });

  test("post can be deleted by author", async () => {
    let response = await request
      .delete(`/api/v1/post/${post2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(204);
  });
  test("blocked users posts are not visible", async () => {
    let response = await request
      .post(`/api/v1/user/blockUser/${user2._id}`)
      .set("Authorization", "Bearer " + token1);
    response = await request
      .post("/api/v1/post")
      .send(sample_post_2)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token1);

    expect(response.status).toBe(200);

    let users: any = [];
    response.body.data.forEach((post) => {
      users.push(post.author._id);
    });
    expect(users).not.toContain(user2._id);
    expect(users).toContain(user1._id);
  });
  test("unblocblocked user posts are visible", async () => {
    let response = await request
      .post(`/api/v1/user/unblockUser/${user2._id}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/post/popular`)
      .set("Authorization", "Bearer " + token1);

    expect(response.status).toBe(200);

    let users: any = [];
    response.body.data.forEach((post) => {
      users.push(post.author._id);
    });
    expect(users).toContain(user2._id);
    expect(users).toContain(user1._id);
  });

  test("posts can be fetched by slug", async () => {
    let response = await request
      .post("/api/v1/post")
      .send(sample_post_1)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(201);
    post1 = response.body;
    expect(post1.voteCount).toBe(1);

    response = await request.get(`/api/v1/post/bySlug/${post1.slug}`)
      .set("Authorization", "Bearer " + token1);
    let post1_byslug = response.body


    expect(post1_byslug._id).toBe(post1._id)
    response = await request
      .post("/api/v1/post")
      .send(sample_post_2)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    post2 = response.body;

    response = await request.get(`/api/v1/post/bySlug/${post2.slug}`)
      .set("Authorization", "Bearer " + token_anon);
    let post2_byslug = response.body
    expect(post2_byslug._id).toBe(post2._id)

  });
});
