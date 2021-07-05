import { GoogleSpreadsheet } from "google-spreadsheet";
import {
  Post,
  Comment,
  connectToMongo,
  closeConnection,
  User,
} from "../models";
import dotenv from "dotenv";
import { post } from "request-promise-native";
import cron from "node-cron";
// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(
  "1LYnzziZjMNU75KcWc-qZwsw9Ir8HRAeykSvRhFEQB3U"
);
const creds = require("../../config/ulkka-in-6cafb44e98cd.json"); // the file saved above
const job1 = cron.schedule("*/30 * * * *", populateSheet, {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
async function populateSheet() {
  dotenv.config();
  await doc.useServiceAccountAuth(creds);
  await connectToMongo();
  await doc.loadInfo(); // loads document properties and worksheets

  const postSheet = doc.sheetsByTitle["posts"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await postSheet.clear();

  let daily = await Post.aggregate([
    { $match: {} },
    {
      $addFields: {
        creationDate: {
          $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
        },
      },
    },
    { $group: { _id: "$creationDate", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  let postRows = daily.map((d) => [d._id, d.count]);
  let postHeaders = ["date", "count"];
  await postSheet.setHeaderRow(postHeaders);
  await postSheet.addRows(postRows);

  const commentSheet = doc.sheetsByTitle["comments"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await commentSheet.clear();

  let dailyComment = await Comment.aggregate([
    { $match: {} },
    {
      $addFields: {
        creationDate: {
          $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
        },
      },
    },
    { $group: { _id: "$creationDate", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  let commentRows = dailyComment.map((d) => [d._id, d.count]);
  let commentHeaders = ["date", "count"];
  await commentSheet.setHeaderRow(commentHeaders);
  await commentSheet.addRows(commentRows);
  const userSheet = doc.sheetsByTitle["users"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await userSheet.clear();

  let dailyUsers = await User.aggregate([
    { $match: {} },
    {
      $addFields: {
        creationDate: {
          $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
        },
      },
    },
    { $group: { _id: "$creationDate", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  let userRows = dailyUsers.map((d) => [d._id, d.count]);
  let userHeaders = ["date", "count"];
  await userSheet.setHeaderRow(userHeaders);
  await userSheet.addRows(userRows);
  await closeConnection();
}

job1.start();
