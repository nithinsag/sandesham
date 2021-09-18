import { connectToMongo, closeConnection, Post, Community, User } from "../models";
import dotenv from 'dotenv'

import fs from 'fs';
import cron from "node-cron";
import axios from "axios";
import _ from 'lodash'
import { getVoteQuery, sendVoteNotificationPost, updatePostKarma, getUserVote } from '../routes/helpers/helpers'
import mongoose from 'mongoose'
dotenv.config()
const job1 = cron.schedule(
  `*/${process.env.UPVOTE_BOT_EPOCH} * * * *`,
  cronMonitorWrapper(
    upVote,
    "https://hc-ping.com/8535d711-2b9f-4853-8d1f-860749952318"
  ),
  {
    timezone: "Asia/Kolkata",
  }
)

function cronMonitorWrapper(f, url) {
  return async () => {
    await f();
    await axios.get(url);
  };
}
export async function upVote() {
  /* Total available votes = 12 * 24 * 2 * size = 500 * size
  * in every epoch a randomly selected post will recieve upvote until it reaches
  * the fake upvote limit
  * A post can reach the limit in 2 hours if the size is 1
  * if there are no new posts in last 2 days.
  * In reality with 40 posts in 2 days, the limit shouldn't hit
  */

  await connectToMongo();
  let approvers = (process.env.UPVOTE_BOT_APPROVERS?.split(',') || [])
  console.log(approvers)
  let posts = await Post.find({
    isDeleted: false,
    voteCount: { $lt: parseInt(process.env.UPVOTE_BOT_LIMIT ?? '20') }, // maximum votes
    created_at: { $gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    upvotes: { $in: approvers }// only if approvers upvoted it
  }).lean() // created_in last 3 days

  console.log(`got ${posts.length} posts for consideration`)
  let postsToUpvote = _.sampleSize(posts, process.env.UPVOTE_BOT_SIZE || 1) // how many votes in an epoch console.log(`upvoting post ${p.title}, ${p.voteCount}`)
  for (let p of postsToUpvote) {
    console.log(`upvoting post ${p.title}, ${p.voteCount}`)
    const user_id = mongoose.Types.ObjectId();
    let preUpdate = p;
    const preUservote = 0
    const type = 1
    let status = await Post.updateOne(
      { _id: p._id },
      getVoteQuery(user_id, type) // upvote
    );
    await sendVoteNotificationPost(preUpdate, type, user_id);
    let post: any = await Post.findOne({ _id: p._id }).lean();
    // using lean to convert to pure js object that we can manipulate
    post.userVote = getUserVote(post, user_id);
    let scoreDelta = post.userVote - preUservote;
    console.log(`score Delta ${scoreDelta}`)
    await updatePostKarma(post.author._id, scoreDelta);
  }


  console.log("completed running job")
  await closeConnection();
}
