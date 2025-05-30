import dotenv from "dotenv";
dotenv.config();
import {
  User,
  Community,
  closeConnection,
  connectToMongo,
  Post,
} from "../models";
import {
  sendMulticastNotification,
  firebaseSendNotification,
} from "../modules/firebase";
import _ from "lodash";
import { logger } from "../helpers/logger";
import { truncateWithEllipses } from "../helpers/utils";
export async function PromoteTopPost(period) {
  logger.info("runnnig promo job");
  let users = await User.find();
  let tokens = users.map((user) => user.pushMessageToken).filter(Boolean);
  let promotionalMessage = await getPromotionalMessage(period);
  if (promotionalMessage) {
    _.chunk(tokens, 400).forEach(async (batch) => {
      let title = `${promotionalMessage.author.displayname}'s post is trending now on Ulkka! 🚀🚀🚀`;
      let text = promotionalMessage.title;
      let postLink = `/post/${promotionalMessage._id}`;
      await sendMulticastNotification(batch, title, text, {
        type: "post",
        link: postLink,
        notification_id: "dummyidforhotfix",
      });
    });
  }
  logger.info("done promo job");
}

export async function notifyTopContributor(hours) {
  logger.info("runnnig top contributor job");
  let aggregateQuery = [
    {
      $match: {
        isDeleted: false,
        isRemoved: false,
        voteCount: { $gte: 5 },
        created_at: {
          $gte: new Date(new Date().getTime() - hours * 60 * 60 * 1000),
        },
      },
    },
    { $sort: { voteCount: -1 } },
    {
      $group: {
        _id: "$community._id",
        post: { $max: { voteCount: "$voteCount", post: "$$ROOT" } },
      },
    },
    { $replaceRoot: { newRoot: "$post.post" } },
    {
      $group: {
        _id: "$author._id",
        post: { $max: { voteCount: "$voteCount", post: "$$ROOT" } },
      },
    },
    { $replaceRoot: { newRoot: "$post.post" } },
  ];

  let topTopPosts = await Post.aggregate(aggregateQuery);

  logger.info(`sending top contribution for ${topTopPosts.length}`);

  for (let post of topTopPosts) {
    logger.info(`sending notificatino to ${post.author.displayname}`);
    let user = await User.findOne({ _id: post.author._id });
    await firebaseSendNotification(
      user,
      `Your post in ${post.community.name} is on fire!🔥🔥🔥🚒`,
      `${post.community.name} members are loving "${truncateWithEllipses(
        post.title,
        20
      )}"! `,
      {
        type: "post",
        link: `/post/${post._id}`,
        notification_id: "dummyhotfix",
      }
    );
  }
  logger.info("done top contributor job");
}
export async function getPromotionalMessage(period) {
  let topPosts = await Post.find({
    created_at: { $gt: new Date(Date.now() - period * 60 * 60 * 1000) },
  })
    .sort({ voteCount: -1, commentCount: -1 })
    .limit(1);
  return topPosts[0];
}

export async function populateCommunityRank() {
  logger.info("start community rank job");
  let aggregateQuery = [
    { $match: {} },
    {
      $lookup: {
        from: "communitymemberships",
        localField: "_id",
        foreignField: "community._id",
        as: "memberCount",
      },
    },
    {
      $lookup: {
        from: "posts",
        let: { communityId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$community._id", "$$communityId"],
                  },
                  {
                    $gte: [
                      "$created_at",
                      new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "postCount",
      },
    },
    {
      $addFields: {
        memberCount: { $size: "$memberCount" },
        postCount: { $size: "$postCount" },
      },
    },
  ];
  let communities = await Community.aggregate(aggregateQuery);

  let minMembers = 1;
  let minPost = 0;
  let maxMemeber = _.max(communities.map((c) => c.memberCount));
  let maxPost = _.max(communities.map((c) => c.postCount));
  _.sortBy(communities, "memberCount").forEach((community, i) => {
    community.memberCountRank =
      (community.memberCount - minMembers) / (maxMemeber - minMembers);
  });
  _.sortBy(communities, "$postCount").forEach((community, i) => {
    community.postCountRank =
      (community.postCount - minPost) / (maxPost - minPost);
  });

  communities.forEach((c) => {
    c.score = (c.memberCountRank + 2*c.postCountRank) / 2;
  });

  let bulkQuery = communities.map((c) => ({
    updateOne: { filter: { _id: c._id }, update: { $set: { score: c.score } } },
  }));

  await Community.bulkWrite(bulkQuery);
  logger.info("done community rank job");
}
