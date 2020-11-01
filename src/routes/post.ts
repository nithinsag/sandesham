import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment, User } from "../models";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy, includes, isArray } from "lodash";
import { getOGData } from '../helpers/openGraphScrapper'


async function addOGData(req, res, next) {
  let post = req.erm.result;
   next();
  // returning early as we don't want to block return
  // TODO: use a queue for this
  try {
    if (post.type == "link") {
      let result = await getOGData(post)
      logger.info(result)
      if (result.success) {
        logger.info("updating post with og data")
        let p = await Post.findOneAndUpdate({ _id: post._id }, { $set: {ogData: result }}, {new: true});
        console.log(p)
      }
    }
  }
  catch (e) {
    console.log(e);
  }

}
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
    postCreate: addOGData,
    postRead: addCurrentUserVote,
  });

  let getVoteQuery = (user_id, type: number) => {
    const voteCountQuery = {
      $set: {
        voteCount: {
          // checking if already voteup, then do nothing, else inc votecount
          $subtract: [{ $size: "$upvotes" }, { $size: "$downvotes" }],
        },
      },
    };

    const voteQueries = {
      // upvote
      // Increase vote count if already not in upvote
      1: [
        {
          $set: {
            upvotes: {
              $setUnion: ["$upvotes", [user_id]],
            },
            downvotes: {
              $setDifference: ["$downvotes", [user_id]],
            },
          },
        },
        voteCountQuery,
      ],
      // downvote
      2: [
        {
          $set: {
            downvotes: {
              $setUnion: ["$downvotes", [user_id]],
            },
            upvotes: {
              $setDifference: ["$upvotes", [user_id]],
            },
          },
        },
        voteCountQuery,
      ],
      // cancel, remove vote from array
      0: [
        {
          $set: {
            upvotes: {
              $setDifference: ["$upvotes", [user_id]],
            },
            downvotes: {
              $setDifference: ["$downvotes", [user_id]],
            },
          },
        },
        voteCountQuery,
      ],
    };

    return voteQueries[type];
  };
  async function updatePostKarma(user, increment){
    return User.findOneAndUpdate({_id: user._id}, {$inc: {postKarma: increment}})
  }
  async function updateCommentKarma(user, increment){
    return User.findOneAndUpdate({_id: user._id}, {$inc: {commentKarma: increment}})
  }
  router.post(
    `${postUri}/:id/vote/:type`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info(`inside vote post with ${req.params.type}`);
      const validVotes = [1, 0, 2];
      let type: number = parseInt(req.params.type);
      if (!includes(validVotes, type)) {
        return res.boom.badRequest("invalid vote type");
      }

      if (req.user) {
        const user_id = req.user._id;
        let preUpdate = await Post.findOne({_id: req.params.id}).lean();
        const preUservote =  getUserVote(preUpdate, req.user);

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
    `${commentUri}/:id/vote/:type`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info(`inside comment vote ${req.params.type} `);
      let type: number = parseInt(req.params.type);
      if (req.user) {
        const user_id = req.user._id;
        let preUpdate = await Comment.findOne({_id: req.params.id}).lean();
        let status = await Comment.updateOne(
          { _id: req.params.id },
          getVoteQuery(user_id, type)
        );
        logger.info(status);
        let comment: any = await Comment.findOne({ _id: req.params.id }).lean();
        comment.userVote = getUserVote(comment, req.user);
        let scoreDelta = comment.userVote -  getUserVote(preUpdate, req.user);
        updateCommentKarma(req.user, scoreDelta); // not waiting for complete
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
