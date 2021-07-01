import { connectToMongo, closeConnection, Comment, Post } from "../models";
import dotenv from "dotenv";

(async () => {
  dotenv.config();
  await connectToMongo();
  let comments = await Comment.find({ community: { $exists: false } });
  for (let comment of comments) {
    let post = await Post.findOne({ _id: comment.post });
    if (post) {
      comment.community = post?.community;
      await comment.save();
    }
  }
  await closeConnection();
})();
