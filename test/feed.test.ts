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

const sample_community_1 = {
  name: "TestCommunityMovies",
  type: "malayalam",
  description: "test community for moview",
};
const sample_community_2 = {
  name: "TestCommunitTVShow",
  type: "malayalam",
  description: "test community for moview",
};
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

  let post1, post2;
  let community1, community2;
  process.env.DEPLOY_ENV = "TEST";
  process.env.DEFAULT_COMMUNITY_ID = "609cb219daba822b65cbbd29";

  response = await request
    .post("/api/v1/community")
    .send(sample_community_1)
    .set("Authorization", "Bearer " + token1);
  expect(response.status).toBe(201);
  community1 = response.body;
  expect(community1.slug).not.toBeNull();
  response = await request
    .post("/api/v1/community")
    .send(sample_community_2)
    .set("Authorization", "Bearer " + token2);
  expect(response.status).toBe(201);
  community2 = response.body;
  expect(community2.slug).not.toBeNull();
  response = await request
    .post(`/api/v1/community/${community1._id}/join`)
    .set("Authorization", "Bearer " + token2);
  expect(response.status).toBe(200);

  response = await request
    .post(`/api/v1/community/${community2._id}/join`)
    .set("Authorization", "Bearer " + token1);
  expect(response.status).toBe(200);
});

beforeEach(() => {
  process.env.DEPLOY_ENV = "TEST";
});

afterAll(async () => {
  if (server) server.stop();
});

const SERVER_PORT = 1338;

describe("Feed routes", () => {
  test("authorized user can fetch community feed ", async () => {});

  test("post can be removed from feed by mod", async () => {});

  test("post cannot be removed from feed by non mod", async () => {});
});
