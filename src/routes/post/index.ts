import { Router } from "express";
import { addCreatedBy } from "../../middlewares/mongoose/author";

import { authenticateFromHeader } from "../../middlewares/authenticate";
import { Post, Comment, User } from "../../models";
import restify from "express-restify-mongoose";
import { logger } from "../../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { commentTreeBuilder } from "./comments";
import { getFeedHandler } from "./helpers/feed";

import {
  preCreateAutoUpvote,
  preCreateAddOGData,
  postReadPost,
  postReadComment,
  updateCommentKarma,
  updatePostKarma,
  preCreateAddCommentMeta,
  postCreateUpdatePostCommentCount,
  postCreateUpdateParentCommentCount,
  postCreateUpdateAuthorKarmaComment,
  postCreateUpdateAuthorKarmaPost,
  getUserVote,
  getVoteQuery,
  sendCommentNotification,
  sendVoteNotificationComment,
  sendVoteNotificationPost,
  doSoftDelete,
  redactDeletedPost,
  authorizeWrites,
} from "./helpers/helpers";
import Joi from "joi";

export function registerRoutes(router: Router) {
  /**
   * Route for getting popular post with pagination
   */
  router.get(
    `/api/v1/post/popular`,
    authenticateFromHeader,
    getFeedHandler("popular")
  );
  router.get(`/api/v1/post/new`, authenticateFromHeader, getFeedHandler("new"));
  router.get(`/api/v1/post/top`, authenticateFromHeader, getFeedHandler("top"));

  const postUri = restify.serve(router, Post, {
    name: "post",
    findOneAndRemove: false,
    findOneAndUpdate: false,
    preMiddleware: authenticateFromHeader,
    preCreate: [addCreatedBy, preCreateAddOGData, preCreateAutoUpvote],
    preDelete: doSoftDelete,
    postRead: postReadPost,
    preUpdate: authorizeWrites,
    postCreate: [postCreateUpdateAuthorKarmaPost],
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
        sendVoteNotificationPost(preUpdate, type, user_id);
        let post: any = await Post.findOne({ _id: req.params.id }).lean();
        // using lean to convert to pure js object that we can manipulate
        post.userVote = getUserVote(post, req.user);
        let scoreDelta = post.userVote - preUservote;
        updatePostKarma(post.author._id, scoreDelta);
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
    `${postUri}/:post_id/comments`,
    authenticateFromHeader,
    commentTreeBuilder
  );

  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    findOneAndRemove: false, // delete is not atomic, we will read the document in to memory and then delete
    findOneAndUpdate: false,
    preMiddleware: authenticateFromHeader,
    preCreate: [addCreatedBy, preCreateAddCommentMeta],
    postCreate: [
      postCreateUpdatePostCommentCount,
      postCreateUpdateParentCommentCount,
      postCreateUpdateAuthorKarmaComment,
      sendCommentNotification,
    ],
    preDelete: doSoftDelete,
    postRead: postReadComment,
    preUpdate: authorizeWrites,
  });

  router.post(
    `${commentUri}/:id/vote/:type`,
    authenticateFromHeader,
    async (req, res) => {
      logger.info(`inside comment vote ${req.params.type} `);
      let type: number = parseInt(req.params.type);
      if (!req.user)
        return res.boom.unauthorized("User needs to be authenticated to vote!");
      const user_id = req.user._id;
      let preUpdate = await Comment.findOne({ _id: req.params.id }).lean();
      let status = await Comment.updateOne(
        { _id: req.params.id },
        getVoteQuery(user_id, type)
      );
      sendVoteNotificationComment(preUpdate, type, user_id);
      let comment: any = await Comment.findOne({ _id: req.params.id }).lean();
      comment.userVote = getUserVote(comment, req.user);
      let scoreDelta = comment.userVote - getUserVote(preUpdate, req.user);
      updateCommentKarma(comment.author._id, scoreDelta); // not waiting for complete
      return res.json(comment);
    }
  );

  router.post(
    `${commentUri}/:id/report`,
    authenticateFromHeader,
    async (req, res) => {
      if (req.user) {
        const user_id = req.user._id;
        const reason = req.body.reason;

        if (reason.length > 0) {
          let status = await Comment.updateOne(
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
}
