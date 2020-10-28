import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy } from "lodash";

export function registerRoutes(router: Router) {
  const postUri = restify.serve(router, Post, {
    name: "post",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });

  router.post(
    `${postUri}/:id/upvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside upvote");
      if (req.user) {
        const user_id = req.user._id;

        let post = await Post.updateOne(
          { _id: req.params.id },
          [
            {
              $set: {
                voteCount: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    "$voteCount",
                    { $add: ["$voteCount", 1] },
                  ],
                },
              },
            },
            {
              $set: {
                upvotes: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    "$upvotes",
                    { $setUnion: ["$upvotes", [user_id]] },
                  ],
                },
              },
            },
            {
              $set: {
                downvotes: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    { $setDifference: ["$downvotes", [user_id]] },
                    "$downvotes",
                  ],
                },
              },
            },
          ],

          { new: true }
        );

        return res.json(post);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.post(
    `${postUri}/:id/downvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside downvote");
      if (req.user) {
        const user_id = req.user._id;

        let post = await Post.updateOne(
          { _id: req.params.id },
          [
            {
              $set: {
                voteCount: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    "$voteCount",
                    { $add: ["$voteCount", -1] },
                  ],
                },
              },
            },
            {
              $set: {
                upvotes: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    { $setDifference: ["$upvotes", [user_id]] },
                    "$upvotes",
                  ],
                },
              },
            },
            {
              $set: {
                downvotes: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    "$downvotes",
                    { $setUnion: ["$downvotes", [user_id]] },
                  ],
                },
              },
            },
          ],

          { new: true }
        );

        return res.json(post);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.get(`${postUri}/:id/graphlookupcomments`, async (req, res) => {
    const post_id = req.params.id;
    logger.info(`creating comment tree for ${post_id}`);

    let posts = await Post.aggregate([
      { $match: { _id: MongooseTypes.ObjectId(post_id) } },
      {
        $graphLookup: {
          from: "comments",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent",
          as: "replies",
        },
      },
    ]);
    // let post = await Post.findOne({ _id: post_id });
    res.json(posts);
  });

  router.get(`${postUri}/:id/comments`, async (req, res) => {
    const post_id = req.params.id;
    let max_depth = 4;

    if (req.params.depth) {
      max_depth = parseInt(req.params.depth);
    }
    logger.info(`creating comment tree for ${post_id}`);

    // TODO: can be optimized for memory by doing more db calls
    // can be optimized later
    let comments: any[] = await Comment.find({
      post: post_id,
           level: { $lte: 4 },
    });
    let commentMap = {};
    let replies: any[] = [];
    comments.forEach((comment) => {
      commentMap[comment._id] = comment.toObject();
      if (comment.level === 0) replies.push(comment.toObject());
    });
    let parentMap = groupBy(comments, "parent");

    function fillRepliesTillDepth(comment, depth) {
      logger.info(`filling comment for ${comment._id}`);
      if (comment.depth > depth) {
        return;
      }
      if (parentMap[comment._id]) {
        let replies = parentMap[comment._id].map((comment) => {
          logger.info(`adding reply ${comment._id}`)
          fillRepliesTillDepth(comment, depth);
          return comment;
        });

        logger.info(`replies ${replies.length}`)
        comment.replies = replies;
      }
      logger.info(comment)
    }

    replies.forEach((reply) => fillRepliesTillDepth(reply, max_depth));

    return res.json(replies);
  });

  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });

  router.post(
    `${commentUri}/:id/upvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside upvote");
      if (req.user) {
        const user_id = req.user._id;

        let comment = await Comment.updateOne(
          { _id: req.params.id },
          [
            {
              $set: {
                voteCount: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    "$voteCount",
                    { $add: ["$voteCount", 1] },
                  ],
                },
              },
            },
            {
              $set: {
                upvotes: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    "$upvotes",
                    { $setUnion: ["$upvotes", [user_id]] },
                  ],
                },
              },
            },
            {
              $set: {
                downvotes: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    { $setDifference: ["$downvotes", [user_id]] },
                    "$downvotes",
                  ],
                },
              },
            },
          ],

          { new: true }
        );

        return res.json(comment);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.post(
    `${commentUri}/:id/downvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside downvote");
      if (req.user) {
        const user_id = req.user._id;

        let comment = await Comment.updateOne(
          { _id: req.params.id },
          [
            {
              $set: {
                voteCount: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    "$voteCount",
                    { $add: ["$voteCount", -1] },
                  ],
                },
              },
            },
            {
              $set: {
                upvotes: {
                  $cond: [
                    { $in: [user_id, "$upvotes"] },
                    { $setDifference: ["$upvotes", [user_id]] },
                    "$upvotes",
                  ],
                },
              },
            },
            {
              $set: {
                downvotes: {
                  $cond: [
                    { $in: [user_id, "$downvotes"] },
                    "$downvotes",
                    { $setUnion: ["$downvotes", [user_id]] },
                  ],
                },
              },
            },
          ],

          { new: true }
        );

        return res.json(comment);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );
}
