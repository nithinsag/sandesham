import dotenv from "dotenv";
dotenv.config();
import { Worker, Job } from "bullmq";
import { send } from "process";
import { User, connectToMongo, Post } from "../models";
import { sendMulticastNotification } from "../modules/firebase";
import { addJobs } from "./index";
import _ from "lodash";

import cron from "node-cron";

const job = cron.schedule("0 20 * * *", PromoteTopPost, { scheduled: false });

console.log("After job instantiation");
// job.start();

async function PromoteTopPost() {
  connectToMongo();
  let users = await User.find();
  let tokens = users.map((user) => user.pushMessageToken).filter(Boolean);
  let promotionalMessage = await getPromotionalMessage();

  _.chunk(tokens, 400).forEach(async (batch) => {
    let title = `${promotionalMessage.author.displayname} is treanding on ulkka! 🚀🚀🚀`;
    let text = promotionalMessage.title;
    let postLink = `/post/${promotionalMessage._id}`;
    sendMulticastNotification(batch, title, text, {
      type: "post",
      link: postLink,
    });
  });
}

async function getPromotionalMessage() {
  let topPosts = await Post.find({
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .sort({ voteCount: -1, commentCount: -1 })
    .limit(1);
  console.log(topPosts);
  return topPosts[0];
}

PromoteTopPost();
