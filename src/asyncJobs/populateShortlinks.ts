import { connectToMongo, closeConnection, Post } from "../models";
import { createDynamicLinkFromPost } from "../helpers/shortlink";

(async () => {
  await connectToMongo();
  let posts = await Post.find({ isDeleted: false, dynamicLink: { $exists: false } })

  try {
    for (let post of posts) {
      let shortLink = await createDynamicLinkFromPost(post)
      post.dynamicLink = shortLink
      await post.save()
    }
  } catch (e) {
    console.log(e)
  }
  console.log("completed running job")
  await closeConnection();
})();
