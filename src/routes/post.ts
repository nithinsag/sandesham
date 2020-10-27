import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
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
    `${postUri}/:id/downvote`,
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
