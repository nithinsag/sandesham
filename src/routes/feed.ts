import {
  Post,
  Community,
  CommunityMembership,
  CommunityBans,
  CommunityMods,
  User,
} from "../models";
import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";
import { Comment } from "../models";
import { getUserVote, redactDeletedPost } from "./helpers/helpers";
import restify from "express-restify-mongoose";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";
import mongoose from "mongoose";
export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/feed/";

  router.get(
    `${API_BASE_URL}home`,
    authenticateFromHeader,
    getFeedHandler("home")
  );

  router.get(
    `${API_BASE_URL}all`,
    authenticateFromHeader,
    getFeedHandler("all")
  );

  router.get(
    `${API_BASE_URL}community/:id`,
    authenticateFromHeader,
    getFeedHandler("community")
  );
  router.get(
    `${API_BASE_URL}user/:id`,
    authenticateFromHeader,
    getFeedHandler("user")
  );
}

export const getFeedHandler = function (type) {
  return async (req, res) => {
    function getSortQuery() {
      let sort = "hot";
      if (["top", "hot", "new"].includes(req.query.sort)) sort = req.query.sort;
      if (sort == "new") {
        return {
          $sort: {
            created_at: -1,
          },
        };
      } else if (sort == "top") {
        return {
          $sort: {
            voteCount: -1,
          },
        };
      } else if (sort == "hot") {
        return {
          $sort: {
            voteCount: -1,
          },
        };
      }
    }

    async function getMatchQuery(type) {
      let matchQuery: any = { isDeleted: false };
      if (req.query && req.query.tag) {
        let tag = (req.query as any).tag;
        matchQuery = {
          ...matchQuery,
          tags: tag,
        };
      }
      if (!req.is_anonymous) {
        let user_id = req.user._id;
        let blockedUsers = [...req.user.blockedUsers];
        matchQuery = {
          ...matchQuery,
          "author._id": { $nin: req.user.blockedUsers },
          reports: { $not: { $elemMatch: { _id: req.user._id } } },
        };
      }
      if (type == "home") {
        let communities = (
          await CommunityMembership.find({ "member._id": req.user._id })
        ).map((communityMembership) => communityMembership.community._id);
        matchQuery = {
          ...matchQuery,
          "community._id": { $in: communities },
        };
      }
      if (type == "community") {
        matchQuery = {
          ...matchQuery,
          "community._id": mongoose.Types.ObjectId(req.params.id),
        };
      }

      if (type == "user") {
        matchQuery = {
          ...matchQuery,
          "author._id": mongoose.Types.ObjectId(req.params.id),
        };
      }

      return matchQuery;
    }
    // TODO: find a way no not hardcode the route
    logger.info(`inside popular feed route`);
    let limit = 10;
    let page = 1; // first page as default

    if (req.query && req.query.page) {
      page = parseInt((req.query as any).page);
    }
    if (req.query && req.query.limit) {
      if (parseInt((req.query as any).limit) < 100) {
        limit = parseInt((req.query as any).limit);
      }
    }

    let user_id = "";
    let blockedUsers: any[] = [];
    logger.info("checking if authorised " + req.is_anonymous);

    let aggregateQuery = [
      { $match: await getMatchQuery(type) },
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
