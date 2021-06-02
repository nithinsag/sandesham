import { connectToMongo, Tweet, asyncForEach } from "./twitterCrawler";
import { Post, User } from "../../models";
import { getOGData } from "../../helpers/openGraphScraper";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

let botUser = {
  _id: process.env.BOT_USER_ID,
  displayname: process.env.BOT_USER,
};

let newsCommunity = {
  _id: process.env.NEWS_COMMUNITY_ID,
  name: process.env.NEWS_COMMUNITY_NAME,
};

export async function postTopTweets() {
  await connectToMongo();
  const onedayago = new Date();
  onedayago.setDate(onedayago.getDate() - 1);
  let topTweets = await Tweet.find({
    alreadyPosted: false,
    url: { $not: { $elemMatch: { expanded_url: /twitter.com/ } } },
    created_at: { $gt: onedayago },
  })
    .sort({
      "public_metrics.like_count": -1,
    })
    .limit(3);

  await asyncForEach(topTweets, async (tweet) => {
    console.log(tweet);
    let url = tweet.entities?.urls[0]?.expanded_url;
    let ogData = await getOGData(url);
    console.log(`got og data for ${url} `);
    try {
      let post = new Post({
        title: tweet.text,
        link: url,
        type: "link",
        author: botUser,
        upvotes: [process.env.BOT_USER_ID],
        voteCount: 1,
        ogData,
        community: newsCommunity,
      });
      //console.log(post);
      await post.save();
      tweet.alreadyPosted = true;
      await tweet.save();
      console.log(`created post ${tweet.text}`);
    } catch (e) {
      console.log(e);
    }
  });
  mongoose.connection.close();
}
