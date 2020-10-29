import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy, includes, isArray } from "lodash";

export function registerRoutes(router: Router) {
  function addCurrentUserVote(req, res, next) {
    if (!req.user) return next();
    let result = req.erm.result;
    const statusCode = req.erm.statusCode; // 200
    if (!isArray(result)) {
      result = [result];
    }
    result.forEach((post) => (post.userVote = getUserVote(post, req.user)));
    return next();
  }
  const postUri = restify.serve(router, Post, {
    name: "post",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
    postRead: addCurrentUserVote,
  });

  let getupvoteQuery = (user_id) => [
    {
      $set: {
        voteCount: {
          $cond: [
            // checking if already voteup, then do nothing, else inc votecount
            { $not: { $in: [user_id, "$upvotes"] } },
            { $add: ["$voteCount", 1] },
            "$voteCount",
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
  ];
  let getdownVoteQuery = (user_id) => [
    {
      $set: {
        voteCount: {
          $cond: [
            { $not: { $in: [user_id, "$downvotes"] } },
            { $add: ["$voteCount", -1] },
            "$voteCount",
          ],
        },
      },
    },
    {
      $set: {
        downvotes: {
          $cond: [
            { $in: [user_id, "$upvotes"] },
            "$downvotes",
            { $setUnion: ["$downvotes", [user_id]] },
          ],
        },
        upvotes: {
          $cond: [
            { $in: [user_id, "$upvotes"] },
            { $setDifference: ["$upvotes", [user_id]] },
            "$upvotes",
          ],
        },
      },
    },
  ];
  router.post(
    `${postUri}/:id/upvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside upvote");
      if (req.user) {
        const user_id = req.user._id;

        await Post.updateOne({ _id: req.params.id }, getupvoteQuery(user_id));
        let post: any = await Post.findOne({ _id: req.params.id });
        post.userVote = getUserVote(post, req.user);
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

        let status = await Post.updateOne(
          { _id: req.params.id },
          getdownVoteQuery(user_id)
        );
        logger.info(status);
        let post = await Post.findOne({ _id: req.params.id });
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
          comment.replies = replies;
        }
      }

      replies.forEach((reply) => fillRepliesTillDepth(reply, max_depth));

      return res.json(replies);
    }
  );

  function addCommentLevel(req, res, next) {
    async function wrapper() {
      let parent = req.body.parent;
      let post = req.body.post;
      let parentPost = await Post.findOne({ _id: post });
      let parentComment;
      if (!parentPost) {
        return res.boom.badRequest("Invalid parent post");
      }
      if (parent) {
        parentComment = await Comment.findOne({ _id: parent });
        if (!parentComment) {
          return res.boom.badRequest("Invalid parent comment");
        }
        req.body.level = parentComment.level + 1;
      } else {
        req.body.level = 0;
      }
      req.parentComment = parentComment;
      req.parentPost = parentPost;

      next();
    }
    wrapper();
  }

  async function updatePostCommentCount(req, res, next) {
    await Post.findOneAndUpdate(
      { _id: req.parentPost._id },
      { $inc: { commentCount: 1 } }
    );
    next();
  }
  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    preMiddleware: authenticateFromHeader,
    preCreate: [addCreatedBy, addCommentLevel],
    postCreate: [updatePostCommentCount],
  });

  router.post(
    `${commentUri}/:id/upvote`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info("inside upvote");
      if (req.user) {
        const user_id = req.user._id;
        let status = await Comment.updateOne(
          { _id: req.params.id },
          getupvoteQuery(user_id)
        );
        logger.info(status);
        let comment = await Comment.findOne({ _id: req.params.id });
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
          getdownVoteQuery(user_id)
        );

        return res.json(comment);
      } else {
        res.boom.unauthorized("User needs to be authenticated to vote!");
      }
    }
  );

  function getUserVote(document, user) {
    if (includes(document.upvotes, user._id)) return 1;
    if (includes(document.downvotes, user._id)) return -1;
    logger.info("no vote yet!");
    return 0;
  }
}
