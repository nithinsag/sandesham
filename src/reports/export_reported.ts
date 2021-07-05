import { GoogleSpreadsheet } from "google-spreadsheet";
import { Post, Comment, connectToMongo, closeConnection } from "../models";
import dotenv from "dotenv";
import { post } from "request-promise-native";
import cron from "node-cron";
// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(
  "1-ypcmxmIgXEBT25z1pYek2e3VzzRAgNGCwu4Z9B5d8c"
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

  let posts = await Post.find({ reports: { $exists: true, $ne: [] } });
  let postRows = posts.map((post) => {
    return [
      post._id,
      post.author.displayname,
      post.voteCount,
      post.link,
      post.type,
      post.title,
      post.description,
      post.community?.name,
      post.commentCount,
      post.created_at,
      post.reports.map((r) => JSON.stringify(r)).join(","),
    ];
  });
  let postHeaders = [
    "postId",
    "author",
    "votes",
    "link",
    "type",
    "title",
    "description",
    "community",
    "commentCount",
    "createdAt",
    "reports",
  ];
  await postSheet.setHeaderRow(postHeaders);
  await postSheet.addRows(postRows);

  const commentSheet = doc.sheetsByTitle["comments"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await commentSheet.clear();
  let comments = await Comment.find({ reports: { $exists: true, $ne: [] } });
  let commentRows = comments.map((comment) => {
    return [
      comment._id,
      comment.author.displayname,
      comment.voteCount,
      comment.text,
      comment.community?.name,
      comment.created_at,
      comment.reports.map((r) => JSON.stringify(r)).join(","),
    ];
  });
  let commentHeaders = [
    "commentId",
    "author",
    "votes",
    "text",
    "community",
    "createdAt",
    "reports",
  ];
  await commentSheet.setHeaderRow(commentHeaders);
  await commentSheet.addRows(commentRows);
  // adding / removing sheets
  //console.log(sheet.rowCount);
  await closeConnection();
}

job1.start();
