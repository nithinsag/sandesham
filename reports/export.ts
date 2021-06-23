import { GoogleSpreadsheet } from "google-spreadsheet";
import { Post, Comment, connectToMongo, closeConnection } from "../src/models";
import dotenv from "dotenv";
import { post } from "request-promise-native";
// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(
  "1cCd0e9DDlqX8CUJAdzlyy14sP_cMWlahjJv0GnswzEE"
);
const creds = require("../config/ulkka-in-6cafb44e98cd.json"); // the file saved above
(async () => {
  dotenv.config();
  await doc.useServiceAccountAuth(creds);
  await connectToMongo();
  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const postSheet = doc.sheetsByTitle["posts"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  postSheet.clear();

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
  postSheet.setHeaderRow(postHeaders);
  postSheet.addRows([postHeaders, ...postRows]);

  console.log(postRows.length);
  const commentSheet = doc.sheetsByTitle["comments"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
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
  commentSheet.setHeaderRow(commentHeaders);
  commentSheet.addRows([commentHeaders, ...commentRows]);
  // adding / removing sheets
  //console.log(sheet.rowCount);
  await closeConnection();
})();
