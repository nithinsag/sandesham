import { Post, Community, CommunityMembership, User } from "../models";
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
    function getSortQuery(type, sort) {
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
            score: -1,
          },
        };
      }
    }

    async function getMatchQuery(type) {
      let user_id = "";
      if (!req.is_anonymous) user_id = req.user._id;
      let matchQuery: any = { isDeleted: false, isRemoved: false };
      if (req.query && req.query.tag) {
        let tag = (req.query as any).tag;
        matchQuery = {
          ...matchQuery,
          tags: tag,
        };
      }
      if (!req.is_anonymous) {
        let blockedUsers = [...req.user.blockedUsers];
        matchQuery = {
          ...matchQuery,
          "author._id": { $nin: req.user.blockedUsers },
          reports: { $not: { $elemMatch: { _id: req.user._id } } },
        };
      }
      if (type == "home") {
        if (req.user) {
          let communities = (
            await CommunityMembership.find({ "member._id": req.user._id })
          ).map((communityMembership) => communityMembership.community._id);
          matchQuery = {
            ...matchQuery,
            "community._id": { $in: communities },
          };
        }
      }
      if (type == "all") {
        if (req.user) {
          let blacklistedCommunities = (
            await Community.find({
              $or: [{ isNSFW: true }, { skipPopular: true }],
            })
          ).map((community) => community._id);
          matchQuery = {
            ...matchQuery,
            "community._id": { $nin: blacklistedCommunities },
          };
        }
      }
      if (type == "community") {
        matchQuery = {
          ...matchQuery,
          "community._id": mongoose.Types.ObjectId(req.params.id),
        };
      }

      if (type == "user") {
        let { isRemoved, ...rest } = matchQuery; // we are removing the isRemoved filter from user routes

        matchQuery = {
          ...rest,
          "author._id": mongoose.Types.ObjectId(req.params.id),
        };
      }

      return matchQuery;
    }

    function getAdditionalFieldsQuery(type, sort, user_id) {
      let query: any | undefined = {
        $addFields: {
          ...(sort == "hot" && {
            score: {
              // https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9
              $sum: [
                { $log: [{ $max: [{ $abs: "$voteCount" }, 1] }, 10] },
                {
                  $multiply: [
                    4,
                    {
                      $log: [{ $max: [{ $sum: ["$commentCount", 1] }, 1] }, 10],
                    },
                  ],
                },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $sum: [{ $toLong: "$created_at" }, -1613054140757] }, // to make log votes and time factor in the same
                        25000000,
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
          }),
          ...(user_id && {
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
          }),
        },
      };
      if (Object.entries(query.$addFields).length === 0) query = undefined;
      return query;
    }
    let user_id = "";
    if (!req.is_anonymous) user_id = req.user._id;
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

    let blockedUsers: any[] = [];
    logger.info("checking if authorised " + req.is_anonymous);

    let sort = "hot";
    if (["top", "hot", "new"].includes(req.query.sort)) sort = req.query.sort;
    let aggregateQuery: any = [
      { $match: await getMatchQuery(type) },
      {
        $lookup: {
          from: "communities",
          localField: "community._id",
          foreignField: "_id",
          as: "community",
        },
      },
      {
        $unwind: {
          path: "$community",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    let additionalFields = getAdditionalFieldsQuery(type, sort, user_id);
    if (additionalFields) {
      aggregateQuery.push(additionalFields);
    }

    aggregateQuery.push(getSortQuery(type, sort));

    aggregateQuery.push({
      $facet: {
        metadata: [
          { $count: "total" },
          { $addFields: { page: page, limit: limit } },
        ],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    });

    let posts = await Post.aggregate(aggregateQuery);
    res.json(posts[0]);
    // res.json(posts);
  };
};
