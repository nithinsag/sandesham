import { Router } from "express";
import { addCreatedBy } from "../../middlewares/mongoose/author";

import { authenticateFromHeader } from "../../middlewares/authenticate";
import { Post, Comment, User } from "../../models";
import restify from "express-restify-mongoose";
import { logger } from "../../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy, includes, isArray, map, sortBy } from "lodash";
import {
  addOGData,
  addCurrentUserVote,
  updateCommentKarma,
  updatePostKarma,
  addCommentLevel,
  getUserVote,
  getVoteQuery,
  updatePostCommentCount,
} from "./helpers";
import { DEFAULT_DEPRECATION_REASON } from "graphql";

export function registerRoutes(router: Router) {
  /**
   * Route for getting popular post with pagination
   */
  router.get(
    `/api/v1/post/popular`,
    authenticateFromHeader,
    async (req, res) => {
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
      logger.info("checking if authorised " + req.is_anonymous);
      if (!req.is_anonymous) {
        user_id = req.user._id;
      }

      let aggregateQuery = [
        // {$match:{whatever is needed here}}
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
                  $divide: [
                    { $sum: [{ $toLong: "$created_at" }, -1613054140757] }, // to make log votes and time factor in the same
                    45000000,
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
        {
          $sort: {
            score: 1,
          },
        },
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
        posts[0].data.forEach(
          (post) => (post.userVote = getUserVote(post, req.user))
        );
      }
      res.json(posts[0]);
      // res.json(posts);
    }
  );

  /**
   * Route for getting newest posts
   */
  router.get(`/api/v1/post/new`, async (req, res) => {
    // TODO: find a way no not hardcode the route
    logger.info(`inside popular feed route`);
    const limit = 10;
    let page = 1; // first page as default

    if (req.query && req.query.page) {
      page = parseInt((req.query as any).page);
    }
    let posts = await Post.aggregate([
      // {$match:{whatever is needed here}}
      {
        $sort: {
          created_at: 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }, { $addFields: { page: page } }],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ]);
    res.json(posts);
  });

  const postUri = restify.serve(router, Post, {
    name: "post",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
    postCreate: addOGData,
    postRead: addCurrentUserVote,
  });
  router.post(
    `${postUri}/:id/vote/:type`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info(`inside vote post with ${req.params.type}`);
      const validVotes = [1, 0, -1];
      let type: number = parseInt(req.params.type);
      if (!includes(validVotes, type)) {
        return res.boom.badRequest("invalid vote type");
      }

      if (req.user) {
        const user_id = req.user._id;
        let preUpdate = await Post.findOne({ _id: req.params.id }).lean();
        const preUservote = getUserVote(preUpdate, req.user);

        let status = await Post.updateOne(
          { _id: req.params.id },
          getVoteQuery(user_id, type)
        );
        let post: any = await Post.findOne({ _id: req.params.id }).lean();
        // using lean to convert to pure js object that we can manipulate
        post.userVote = getUserVote(post, req.user);
        let scoreDelta = post.userVote - preUservote;
        updatePostKarma(req.user, scoreDelta);
        return res.json(post);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.post(
    `${postUri}/:id/report`,
    authenticateFromHeader,
    async (req, res) => {
      if (req.user) {
        const user_id = req.user._id;
        const reason = req.body.reason;

        if (reason.length > 0) {
          let status = await Post.updateOne(
            { _id: req.params.id },
            {
              $push: {
                reports: {
                  _id: user_id,
                  reason: reason,
                },
              },
            }
          );
          // using lean to convert to pure js object that we can manipulate
          return res.json({ success: true });
        } else {
          return res.json({ error: true, message: "Missing reporting reason" });
        }
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.get(
    `${postUri}/:id/comments`,
    authenticateFromHeader,
    async (req, res) => {
      const post_id = req.params.id;
      let max_depth = 4;
      if (req.params.depth) {
        max_depth = parseInt(req.params.depth);
      }
      logger.debug(`creating comment tree for ${post_id}`);

      // TODO: can be optimized for memory by doing more db calls
      // can be optimized later
      let comments: any[] = await Comment.find({
        post: post_id,
        level: { $lte: 4 },
      }).lean();
      let commentMap = {};
      let replies: any[] = [];
      comments.forEach((comment) => {
        commentMap[comment._id] = comment;
        if (comment.level === 0) {
          let commentObject = comment;
          if (req.user) {
            commentObject.userVote = getUserVote(commentObject, req.user);
          }
          replies.push(commentObject);
        }
      });
      let parentMap = groupBy(comments, "parent");

      function fillRepliesTillDepth(comment, depth) {
        logger.debug(`filling comment for ${comment._id}`);
        if (comment.depth > depth) {
          return;
        }
        let replies: any[] = [];
        if (parentMap[comment._id]) {
          parentMap[comment._id].forEach((comment) => {
            logger.debug(`adding reply ${comment._id}`);
            let commentObject = comment;
            if (req.user) {
              commentObject.userVote = getUserVote(commentObject, req.user);
            }
            fillRepliesTillDepth(commentObject, depth);
            replies.push(commentObject);
          });

          logger.debug(`replies  for ${comment._id} ${replies.length}`);
          replies = sortBy(replies, ["voteCount"]);
          comment.replies = replies;
        }
      }

      replies = sortBy(replies, ["voteCount"]);
      replies.forEach((reply) => fillRepliesTillDepth(reply, max_depth));

      return res.json(replies);
    }
  );

  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    preMiddleware: authenticateFromHeader,
    preCreate: [addCreatedBy, addCommentLevel],
    postCreate: [updatePostCommentCount],
  });

  router.post(
    `${commentUri}/:id/vote/:type`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info(`inside comment vote ${req.params.type} `);
      let type: number = parseInt(req.params.type);
      if (req.user) {
        const user_id = req.user._id;
        let preUpdate = await Comment.findOne({ _id: req.params.id }).lean();
        let status = await Comment.updateOne(
          { _id: req.params.id },
          getVoteQuery(user_id, type)
        );
        let comment: any = await Comment.findOne({ _id: req.params.id }).lean();
        comment.userVote = getUserVote(comment, req.user);
        let scoreDelta = comment.userVote - getUserVote(preUpdate, req.user);
        updateCommentKarma(req.user, scoreDelta); // not waiting for complete
        return res.json(comment);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );
}
