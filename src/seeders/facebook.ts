import { Post, User, connectToMongo } from "../models";
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";
import { getOGData } from "../helpers/openGraphScraper";
dotenv.config();
const CP_FILE = "facebook_lastrun";
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

fs.createReadStream("src/seeders/posts.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    try {
      for (let row of results) {
        let posted_at = new Date(row["date"]);
        if (!lastrun || posted_at > lastrun) {
          let ogData = await getOGData(row["url"]);
          console.log(ogData);
          let title = ogData.title;
          let description = ogData.description;
          try {
            let post = new Post({
              title,
              posted_at,
              description,
              link: row["url"],
              type: "link",
              author: botUser,
              ogData,
            });
            //console.log(post);
            //            await post.save();
          } catch (e) {
            console.log(e);
          }
        }
        fs.writeFileSync(CP_FILE, new Date().toISOString());
      }
    } catch (e) {
      console.log(e);
    }
    mongoose.connection.close();
  });
