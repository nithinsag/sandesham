import dotenv from "dotenv";
dotenv.config();
import { User, connectToMongo, Post } from "../models";
import { sendMulticastNotification } from "../modules/firebase";
import _ from "lodash";
import mongoose from "mongoose";
import cron from "node-cron";

const job1 = cron.schedule("0 20 * * *", getSchedulerFunction(4), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
const job2 = cron.schedule("0 14 * * *", getSchedulerFunction(8), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});

function getSchedulerFunction(period) {
  return function () {
    PromoteTopPost(period);
  };
}
async function PromoteTopPost(period) {
  let users = await User.find();
  let tokens = users.map((user) => user.pushMessageToken).filter(Boolean);
  let promotionalMessage = await getPromotionalMessage(period);
  if (promotionalMessage) {
    _.chunk(tokens, 400).forEach(async (batch) => {
      let title = `${promotionalMessage.author.displayname}'s post is trending now on Ulkka! 🚀🚀🚀`;
      let text = promotionalMessage.title;
      let postLink = `/post/${promotionalMessage._id}`;
      await sendMulticastNotification(batch, title, text, {
        type: "post",
        link: postLink,
      });
    });
  }
}

async function getPromotionalMessage(period) {
  let topPosts = await Post.find({
    created_at: { $gt: new Date(Date.now() - period * 60 * 60 * 1000) },
  })
    .sort({ voteCount: -1, commentCount: -1 })
    .limit(1);
  console.log(topPosts);
  return topPosts[0];
}
(async () => {
  await connectToMongo();
  job1.start();
  job2.start();
})();
