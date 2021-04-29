import { Post, User, connectToMongo } from "../models";
import dotenv from "dotenv";
import csv from "csv-parser";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";
import { getOGData } from "../helpers/openGraphScraper";
import { v2 as cloudinary } from "cloudinary";
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
          const uniqueFilename = new Date().toISOString();
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          let image = await cloudinary.uploader.upload(
            `src/seeders/${row["asset_path"]}`,
            {
              public_id: `image/${uniqueFilename}`,
              tags: `image`,
              resource_type: "auto",
            } // directory and tags are optional
          );
          console.log("file uploaded to Cloudinary");
          if (image && process.env.CLOUDINARY_RESP_URL && process.env.CDN_URL) {
            image.url = image.url.replace(
              process.env.CLOUDINARY_RESP_URL,
              process.env.CDN_URL
            );
            image.secure_url = image.secure_url.replace(
              process.env.CLOUDINARY_RESP_URL,
              process.env.CDN_URL
            );
          }
          console.log(image);
          let title = row["title"];
          try {
            let post = new Post({
              title,
              link: image.secure_url,
              type: "image",
              author: botUser,
              mediaMetadata: image,
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
