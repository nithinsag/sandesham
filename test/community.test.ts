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
const test_comment = {
  text: "some random reply comment",
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

describe("Community routes", () => {
  let post1, post2;
  let community1, community2;
  process.env.DEPLOY_ENV = "TEST";
  process.env.DEFAULT_COMMUNITY_ID = "609cb219daba822b65cbbd29";

  test("gets the root endpoint", async () => {
    const response = await request.get("/");
    expect(response.status).toBe(200);
  });

  test("can't create new community without authentication", async () => {
    const response = await request.post("/api/v1/community");
    expect(response.status).toBe(400);
  });

  test("signed up user can create community ", async () => {
    let response = await request
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
  });

  test("signed up user can join community ", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/join`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .post(`/api/v1/community/${community2._id}/join`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("members can favorite communities community ", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/favorite`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .post(`/api/v1/community/${community1._id}/favorite`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    response = await request
      .post(`/api/v1/community/${community1._id}/unfavorite`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    response = await request
      .post(`/api/v1/community/${community2._id}/favorite`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("admin user can make users admins of communities", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/addAsAdmin/${user2._id}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body).toBe(true);
    expect(response.status).toBe(200);
  });
  test("admin user can dismiss other admins of communities", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/dismissAsAdmin/${user2._id}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.body).toBe(true);
    expect(response.status).toBe(200);
  });

  test("authorized user can fetch community feed ", async () => {
    let response = await request
      .post("/api/v1/post")
      .send({
        ...sample_post_1,
        community: { _id: community1._id, name: community1.name },
      })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(201);
    post1 = response.body;
    expect(post1.voteCount).toBe(1);

    response = await request
      .post("/api/v1/post")
      .send({
        ...sample_post_2,
        community: { _id: community2._id, name: community2.name },
      })
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(201);
    post2 = response.body;

    response = await request
      .get(`/api/v1/feed/community/${community1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(1);
    response = await request
      .get(`/api/v1/feed/community/${community2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;
    expect(posts).toHaveLength(1);
  });
  test("admin user can ban user from communities", async () => {
    let response = await request
      .post(`/api/v1/community/${community2._id}/ban/${user1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.body).toBe(true);
    expect(response.status).toBe(200);

    response = await request
      .post("/api/v1/post")
      .send({
        ...sample_post_1,
        community: { _id: community2._id, name: community2.name },
      })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(401);

    response = await request
      .post(`/api/v1/comment`)
      .send({ post: post2._id, ...test_comment })
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(401);

    response = await request
      .post(`/api/v1/community/${community2._id}/ban/${user1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.body).toBe(true);
    expect(response.status).toBe(200);
    response = await request
      .post(`/api/v1/community/${community2._id}/unban/${user1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.body).toBe(true);
    expect(response.status).toBe(200);
    response = await request
      .post(`/api/v1/community/${community2._id}/unban/${user1._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(400);
  });
  test("signed up user can leave community ", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/leave`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body).toBe(true);

    response = await request
      .post(`/api/v1/community/${community1._id}/leave`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body).toBe(false);
  });

  test("admins can remove posts from community", async () => {
    let response = await request
      .post("/api/v1/post")
      .send({
        ...sample_post_2,
        community: { _id: community2._id, name: community2.name },
      })
      .set("Authorization", "Bearer " + token1);
    let post3 = response.body;
    expect(response.status).toBe(201);

    response = await request
      .get(`/api/v1/feed/community/${community2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(2);

    response = await request
      .post(`/api/v1/post/${post3._id}/remove`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(401);

    response = await request
      .post(`/api/v1/post/${post3._id}/remove`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/feed/community/${community2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(1);
  });

  test("authorized user can fetch home feed ", async () => {
    let response = await request
      .get(`/api/v1/feed/home`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(1);

    response = await request
      .post(`/api/v1/community/${community2._id}/join`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/feed/home`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;
    expect(posts).toHaveLength(1);

    response = await request
      .post(`/api/v1/community/${community1._id}/join`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/feed/home`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;
    expect(posts).toHaveLength(2);
  });
  test("home feed can be sorted by top/new/hot", async () => {
    let response = await request
      .get(`/api/v1/feed/home?sort=hot`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(2);
    response = await request
      .get(`/api/v1/feed/home?sort=top`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(2);
    response = await request
      .get(`/api/v1/feed/home?sort=new`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(2);
  });

  test("top post feed can be filtered from created at", async () => {
    let posts;
    let response = await request
      .get(`/api/v1/feed/home?sort=top&from=${Date.now() + 1000000}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(0);

    response = await request
      .get(`/api/v1/feed/home?sort=top&from=${Date.now() - 100000000}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(2);
  });

  test("all posts can be fetched in all feed", async () => {
    let response;
    response = await request
      .get(`/api/v1/feed/all?sort=hot`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(2);
  });
  test("feed can be fetched by anonymous user", async () => {
    let response = await request
      .get(`/api/v1/feed/all?sort=hot`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    let posts = response.body.data;

    expect(posts).toHaveLength(2);
    response = await request
      .get(`/api/v1/feed/home?sort=hot`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    posts = response.body.data;

    expect(posts).toHaveLength(2);
  });
  test("admins can pin/unpin posts", async () => {
    let response = await request
      .post("/api/v1/post")
      .send({
        ...sample_post_2,
        community: { _id: community2._id, name: community2.name },
      })
      .set("Authorization", "Bearer " + token1);
    let post4 = response.body;
    expect(response.status).toBe(201);

    response = await request
      .post(`/api/v1/post/${post4._id}/vote/-1`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .post(`/api/v1/post/${post4._id}/pin`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/feed/community/${community2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    let top_post = response.body.data[0];
    expect(post4._id).toBe(top_post._id);

    response = await request
      .post(`/api/v1/post/${post4._id}/unpin`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/feed/community/${community2._id}`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    top_post = response.body.data[0];
    expect(top_post._id).not.toBe(post4._id);
  });
  test("communities can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/${community1._id}`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(community1._id);

    response = await request
      .get(`/api/v1/community/${community1._id}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(community1._id);
  });
  test("community members can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/${community1._id}/members`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);

    response = await request
      .get(`/api/v1/community/${community1._id}/members`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/community/${community1._id}/members`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/community/${community2._id}/members`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
  });
  test("communities can be searched", async () => {
    let response = await request
      .get(`/api/v1/community/search?text=test`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(2);
  });
  test("community admins can search members", async () => {
    let response = await request
      .get(
        `/api/v1/community/${community1._id}/searchMembersByName?displayname=test`
      )
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(2);
    response = await request
      .get(
        `/api/v1/community/${community1._id}/searchMembersByName?displayname=`
      )
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(2);
  });
  test("community admins can see banned members", async () => {
    let response = await request
      .post(`/api/v1/community/${community1._id}/ban/${user2._id}`)
      .set("Authorization", "Bearer " + token1);
    response = await request
      .get(`/api/v1/community/${community1._id}/bannedMembers`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(1);
  });
  test("community admins can toggle notifications", async () => {
    let response = await request
      .post(`/api/v1/community/${community2._id}/toggleAdminNotifications`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body).toBe(false);
    response = await request
      .post(`/api/v1/community/${community2._id}/toggleAdminNotifications`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body).toBe(true);
  });
  test("community members can toggle post notification", async () => {
    let response = await request
      .post(`/api/v1/community/${community2._id}/enablePostNotification`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body.disablePostNotification).toBe(false);
    response = await request
      .post(`/api/v1/community/${community2._id}/disablePostNotification`)
      .set("Authorization", "Bearer " + token2);
    expect(response.status).toBe(200);
    expect(response.body.disablePostNotification).toBe(true);
  });
  test("community categories can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/category`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("community can be fetched by name", async () => {
    let response = await request
      .get(`/api/v1/community/byName?name=${community1.name}`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(community1._id);
  });
  test("community recommendations can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/top`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("community recommendations grouped by type can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/topByTopic`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
  });
  test("community filter can be fetched", async () => {
    let response = await request
      .get(`/api/v1/community/filter`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/community/filter?context=popular`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/community/filter?context=home`)
      .set("Authorization", "Bearer " + token1);
    expect(response.status).toBe(200);
    response = await request
      .get(`/api/v1/community/filter?context=home`)
      .set("Authorization", "Bearer " + token_anon);
    expect(response.status).toBe(200);
  });
});
