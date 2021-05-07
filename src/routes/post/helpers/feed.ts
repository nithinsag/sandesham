import { logger } from "../../../helpers/logger";
import { Post, Comment, User } from "../../../models";
import { getUserVote, redactDeletedPost } from "./helpers";

export const getFeedHandler = function (type) {
  function getSortQuery() {
    if (type == "new") {
      return {
        $sort: {
          created_at: -1,
        },
      };
    } else if (type == "top") {
      return {
        $sort: {
          voteCount: -1,
        },
      };
    } else if (type == "popular") {
      return {
        $sort: {
          voteCount: -1,
        },
      };
    }
  }
  return async (req, res) => {
    // TODO: find a way no not hardcode the route
    logger.info(`inside popular feed route`);
    let limit = 10;
    let page = 1; // first page as default

    let matchQuery: any = { isDeleted: false };
    if (req.query && req.query.page) {
      page = parseInt((req.query as any).page);
    }
    if (req.query && req.query.tag) {
      let tag = (req.query as any).tag;
      matchQuery = {
        ...matchQuery,
        tags: tag,
      };
    }
    if (req.query && req.query.limit) {
      if (parseInt((req.query as any).limit) < 100) {
        limit = parseInt((req.query as any).limit);
      }
    }

    let user_id = "";
    let blockedUsers: any[] = [];
    logger.info("checking if authorised " + req.is_anonymous);
    if (!req.is_anonymous) {
      user_id = req.user._id;
      blockedUsers = [...req.user.blockedUsers];
      matchQuery = {
        ...matchQuery,
        "author._id": { $nin: req.user.blockedUsers },
        reports: { $not: { $elemMatch: { _id: req.user._id } } },
      };
    }

    let aggregateQuery = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "communities",
          localField: "community",
          foreignField: "_id",
          as: "community",
        },
      },
      {
        $set: {
          community: { $arrayElemAt: ["$community", 0] },
        },
      },

      {
        $addFields: {
          score: {
            // https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9
            $sum: [
              { $log: [{ $max: [{ $abs: "$voteCount" }, 1] }, 10] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $sum: [{ $toLong: "$created_at" }, -1613054140757] }, // to make log votes and time factor in the same
                      4500000,
                    ],
                  },
                  {
                    $divide: [
                      "$voteCount",
                      { $max: [{ $abs: "$voteCount" }, 1] },
                    ],
                  },
                ],
              },
            ],
          },
          userVote: {
            $subtract: [
              {
                $size: {
                  $filter: {
                    input: "$upvotes",
                    as: "upvote",
                    cond: { $eq: ["$$upvote", user_id] },
                  },
                },
              },
              {
                $size: {
                  $filter: {
                    input: "$downvotes",
                    as: "downvote",
                    cond: { $eq: ["$$downvote", user_id] },
                  },
                },
              },
            ],
          },
        },
      },
      getSortQuery(),
      {
        $facet: {
          metadata: [
            { $count: "total" },
            { $addFields: { page: page, limit: limit } },
          ],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];

    let posts = await Post.aggregate(aggregateQuery);
    if (req.user) {
      posts[0].data.forEach((post) => {
        post.userVote = getUserVote(post, req.user);
        post = redactDeletedPost(post);
      });
    }
    res.json(posts[0]);
    // res.json(posts);
  };
};
