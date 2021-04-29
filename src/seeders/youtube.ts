import { Post, User, connectToMongo } from "../models";
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";
import { getOGData } from "../helpers/openGraphScraper";
dotenv.config();
const CP_FILE = "youtube_lastrun";
let connection = connectToMongo();
let botUser = {
  _id: process.env.BOT_USER_ID,
  displayname: process.env.BOT_USER,
};

let results: any = [];
let chekpoint = fs.readFileSync(CP_FILE).toString();
let lastrun: Date | undefined;
if (chekpoint) {
  lastrun = new Date(chekpoint);
}
console.log("last run at " + lastrun);

fs.createReadStream("youtube-accounts.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    console.log(results);
    try {
      for (let channel of results) {
        let channelId = Object.values(channel)[0];
        let url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=20`;
        console.log(url);
        let response = await axios.get(url);
        let feed = response.data;
        const videoUrlPrefix = "https://www.youtube.com/watch?v=";
        //console.log(feed);
        for (let item of feed.items) {
          let posted_at = new Date(item["snippet"]["publishedAt"]);
          // console.log(item);
          if (
            item["id"]["kind"] == "youtube#video" &&
            (!lastrun || posted_at > lastrun)
          ) {
            let videoId = item["id"]["videoId"];
            let url = videoUrlPrefix + videoId;
            let title = item["snippet"]["title"];
            let description = item["snippet"]["description"];
            let ogData = await getOGData(url);
            console.log(`got og data for ${url} `);
            try {
              let post = new Post({
                title,
                posted_at,
                description,
                link: url,
                type: "link",
                author: botUser,
                upvotes: [process.env.BOT_USER_ID],
                voteCount: 1,
                ogData,
              });
              //console.log(post);
              //            await post.save();
            } catch (e) {
              console.log(e);
            }
          }
        }
        fs.writeFileSync(CP_FILE, new Date().toISOString());
      }
    } catch (e) {
      console.log(e);
    }
    mongoose.connection.close();
  });
