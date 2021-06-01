import { crawlTweets } from "./twitterCrawler";
import { postTopTweets } from "./TwitterPoster";
import cron from "node-cron";
const job3 = cron.schedule(
  "0 */3 * * *",
  async () => {
    console.log("executing crawler");
    await crawlTweets();
    console.log("executing populator");
    await postTopTweets();
  },
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);

job3.start();
