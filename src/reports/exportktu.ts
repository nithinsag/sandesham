import { GoogleSpreadsheet } from "google-spreadsheet";
import { Post, Comment, connectToMongo, closeConnection } from "../models";
import dotenv from "dotenv";
import { post } from "request-promise-native";
import cron from "node-cron";
import mongoose from "mongoose";
// Initialize the sheet - doc ID is the long id in the sheets URL
const doc = new GoogleSpreadsheet(
  "1-CV_suh6CdQttEEMh17YaVf5WqCJTujEqIeuKzCepPo"
);
const creds = require("../../config/ulkka-in-6cafb44e98cd.json"); // the file saved above
const job1 = cron.schedule("0 */6 * * *", populateSheet, {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
async function populateSheet() {
  dotenv.config();
  await doc.useServiceAccountAuth(creds);
  await connectToMongo();
  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);

  const postSheet = doc.sheetsByTitle["winners"]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  await postSheet.clear();
  let aggregateQuery = [
    {
      $match: {
        "community._id": mongoose.Types.ObjectId("60d44b8e92266fb92491bb00"),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "author._id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $addFields: {
        creationDate: {
          $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
        },
      },
    },
    { $sort: { voteCount: -1 } },
    {
      $group: {
        _id: "$creationDate",
        post: { $max: { voteCount: "$voteCount", post: "$$ROOT" } },
      },
    },
  ];
  /**
   * {
    "_id": "2021-07-02",
    "post": {
      "voteCount": 17,
      "post": {
        "_id": {"$oid": "60de926d6b323622cc38c887"},
        "status": "enabled",
        "voteCount": 17,
        "commentCount": 12,
        "tags": [],
        "upvotes": [
          {"$oid": "6087f323748be47e71261e7b"},
        ],
        "downvotes": [],
        "isDeleted": false,
        "isRemoved": false,
        "isPinned": false,
        "title": "കുഞ്ഞൂട്ടി എന്റെ കുഞ്ഞൂട്ടി നാട് ചുറ്റണ കുഞ്ഞൂട്ടി ഓടി വരണ കുഞ്ഞൂട്ടി കുഞ്ഞൂട്ടി എന്റെ കുഞ്ഞൂട്ടി",
        "type": "image",
        "community": {
          "name": "#troll_ktu_official",
          "_id": {"$oid": "60d44b8e92266fb92491bb00"}
        },
        "link": "https://media.ulkka.in/image/upload/v1625199212/image/2021-07-02T04:13:30.607Z.jpg",
        "mediaMetadata": {
    
        },
        "author": {
          "_id": {"$oid": "60db17c6666d3c2a094d4bd8"},
          "displayname": "skycracker"
        },
        "reports": [],
        "created_at": {"$date": "2021-07-02T04:13:33.652Z"},
        "updated_at": {"$date": "2021-07-02T04:13:33.652Z"},
        "slug": "-YW7wprS3Dd",
        "__v": 0,
        "user": [
          {
            "_id": {"$oid": "60db17c6666d3c2a094d4bd8"},
            "role": "user",
            "postKarma": 194,
            "commentKarma": 46,
            "bio": "",
            "blockedUsers": [],
            "name": "Sky Cracker",
            "email": "amalprem2017@gmail.com",
            "picture": "https://lh3.googleusercontent.com/a-/AOh14GgnMsx2kmkR6TrrarXsHlcz4E4qTljSLChyp6afrw=s96-c",
            "created_at": {"$date": "2021-06-29T12:53:26.978Z"},
            "displayname": "skycracker",
            "updated_at": {"$date": "2021-06-29T12:53:26.978Z"},
            "__v": 0,
            "pushMessageToken": "foqGjm2oSp-TY5J9xDWYYA:APA91bGkX_svpFkHXv3_9TtnT9-RvJi4aO5cH3IRakm7xSxraPnjB76lY3fFGmXRQJ3dWLNcjgUUBt0y7bbnrEmFVm_cU2H3FmrgzaEsOOlcCyEVqw7BOE1YLz6kpDjEHtYIAkGHz4FH"
          }
        ],
        "creationDate": "2021-07-02"
      }
    }
  },
   */

  let posts = await Post.aggregate(aggregateQuery);
  let postRows = posts.map((post) => {
    return [
      post._id,
      post.post.post.user.displayname,
      post.post.post.user.email,
      post.post.voteCount,
      post.post.post.title,
      post.post.post.created_at,
      post.post.post.community?.name,
    ];
  });
  let postHeaders = [
    "date",
    "author",
    "email",
    "voteCount",
    "title",
    "createdAt",
    "community",
  ];
  await postSheet.setHeaderRow(postHeaders);
  await postSheet.addRows(postRows);

  console.log(postRows.length);
  // adding / removing sheets
  //console.log(sheet.rowCount);
  await closeConnection();
}

job1.start();
