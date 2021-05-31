import { crawlTweets } from "./twitterCrawler";
import { postTopTweets } from "./TwitterPoster";
import cron from "node-cron";
const job3 = cron.schedule(
  "0 */3 * * *",
  async () => {
    await crawlTweets();
    await postTopTweets();
  },
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);
