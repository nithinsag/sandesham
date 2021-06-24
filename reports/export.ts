import { GoogleSpreadsheet } from "google-spreadsheet";
import { Post, Comment, connectToMongo, closeConnection } from "../src/models";
import dotenv from "dotenv";
import { post } from "request-promise-native";
import cron from "node-cron";
// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(
  "1cCd0e9DDlqX8CUJAdzlyy14sP_cMWlahjJv0GnswzEE"
);
const creds = require("../config/ulkka-in-6cafb44e98cd.json"); // the file saved above
const job1 = cron.schedule("*/10 * * * *", populateSheet, {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
async function populateSheet() {
  dotenv.config();
  await doc.useServiceAccountAuth(creds);
  await connectToMongo();
  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const postSheet = doc.sheetsByTitle["posts"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await postSheet.clear();

  let posts = await Post.find();
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
  ];
  await postSheet.setHeaderRow(postHeaders);
  await postSheet.addRows(postRows);

  console.log(postRows.length);
  const commentSheet = doc.sheetsByTitle["comments"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await commentSheet.clear();
  let comments = await Comment.find();
  let commentRows = comments.map((comment) => {
    return [
      comment._id,
      comment.author.displayname,
      comment.voteCount,
      comment.text,
      comment.community?.name,
      comment.created_at,
    ];
  });
  console.log(commentRows.length);
  let commentHeaders = [
    "commentId",
    "author",
    "votes",
    "text",
    "community",
    "createdAt",
  ];
  await commentSheet.setHeaderRow(commentHeaders);
  await commentSheet.addRows(commentRows);
  // adding / removing sheets
  //console.log(sheet.rowCount);
  await closeConnection();
}

job1.start();
