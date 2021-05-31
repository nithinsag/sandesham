import axios from "axios";
import mongoose, { Schema, Document } from "mongoose";
import dotenv from "dotenv";
import { bool } from "joi";
import { ObjectValueNode } from "graphql";
dotenv.config();

let TweetSchema = new Schema({
  id: { type: String, unique: true },
  text: { type: String },
  alreadyPosted: { type: Boolean, default: false },
  public_metrics: { type: Object },
  entities: { type: Object },
  created_at: { type: Date, default: Date.now },
});
export interface ITweet extends Document {
  entities: { urls: [{ expanded_url: String }] };
  pureText: string;
  alreadyPosted: boolean;
  public_metrics: object;
}

export const Tweet = mongoose.model<ITweet>("Tweet", TweetSchema);

export async function connectToMongo() {
  let connection = await mongoose.connect(process.env.MONGO_URI!, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    autoIndex: true,
  });

  return connection;
}
export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
let token =
  "AAAAAAAAAAAAAAAAAAAAALCtQAEAAAAAZYC%2FErt0CfXDvAtbYpoWLj6HQtk%3DMrB2tHIgvBkaBLZmSF4fZBtHpFuzgyiFAE9bU7qrh6UCWZrCId";
axios.defaults.headers.common = { Authorization: `bearer ${token}` };
let accounts = [
  {
    id: "39225438",
    name: "Manorama Online",
    username: "manoramaonline",
  },
  {
    id: "25244464",
    name: "Manorama News",
    username: "manoramanews",
  },
  {
    id: "277386148",
    name: "Asianet News",
    username: "AsianetNewsML",
  },
  {
    id: "19584103",
    name: "Mathrubhumi",
    username: "mathrubhumi",
  },
  {
    id: "18186688",
    name: "OneIndia Malayalam",
    username: "thatsMalayalam",
  },
  {
    id: "69508326",
    name: "Kairali News Online",
    username: "kairalionline",
  },
];

function apiUrlTemplate(userId) {
  return `https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=text,entities,created_at,source,public_metrics&user.fields=&media.fields&place.fields`;
}
let tweets: any[] = [];

async function crawlTweets() {
  await connectToMongo();
  await asyncForEach(accounts, async (account) => {
    let user_id = account.id;
    let response = await axios.get(apiUrlTemplate(user_id));
    console.log(`fetching tweets from ${account.name}`);
    let accountTweets = response.data.data.map((tweet) => {
      return { ...tweet, account: account };
    });
    tweets.push(...accountTweets);
  });
  console.log(tweets);
  let bulkOps: any[] = [];

  await asyncForEach(tweets, async (tweet) => {
    let text = tweet.text;
    if (text) {
      text = text.replace(/\#\w+/g, ""); //replace hashtags
      text = text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, ""); //replace hashtags
      tweet.pureText = text;
      tweet.text = text;
    }
    try {
      let tweetDoc = await Tweet.findOne({
        id: tweet.id,
      });
      if (tweetDoc) {
        tweetDoc.public_metrics = tweet.public_metrics;
      } else {
        tweetDoc = new Tweet(tweet);
      }
      await tweetDoc?.save();
    } catch (e) {
      console.log(e);
    }
  });

  mongoose.connection.close();
}

if (require.main === module) {
  crawlTweets();
}
