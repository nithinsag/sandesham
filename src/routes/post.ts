import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
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

  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });

  router.post(
    `${commentUri}/:id/upvote`,
    authenticateFromHeader,
    (req, res) => {
      if (req.user) {
        res.json({ status: "upvoted" });
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  router.post(
    `${commentUri}/:id/downvote`,
    authenticateFromHeader,
    (req, res) => {
      if (req.user) {
        res.json({ status: "downvoted" });
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );
}
