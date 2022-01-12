import { Router } from "express";
import { addCreatedBy } from "../../middlewares/mongoose/author";

import { authenticateFromHeader } from "../../middlewares/authenticate";
import { Post, Comment, User, CommunityMembership } from "../../models";
import restify from "express-restify-mongoose";
import { logger } from "../../helpers/logger";
import { Types as MongooseTypes } from "mongoose";
import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { commentTreeBuilder } from "./comments";
import { getFeedHandler } from "../helpers/feed";

import {
  preCreateAutoUpvote,
  preCreateAddOGData,
  postReadPost,
  postReadComment,
  updateCommentKarma,
  updatePostKarma,
  preCreateAddCommentMeta,
  preCreateDefaultCommunity,
  postCreateUpdatePostCommentCount,
  postCreateUpdateParentCommentCount,
  postCreateUpdateAuthorKarmaComment,
  postCreateUpdateAuthorKarmaPost,
  postCreateNotifyFollowers,
  preCreateCommentBlockBannedUsers,
  preCreatePostBlockBannedUser,
  getUserVote,
  getVoteQuery,
  sendCommentNotification,
  sendVoteNotificationComment,
  sendVoteNotificationPost,
  doSoftDelete,
  redactDeletedPost,
  authorizeWrites,
  preCreateGenerateRandomUser,
  postCreateGenerateDynamicLink
} from "../helpers/helpers";
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

  const postUri = restify.serve(router, Post, {
    name: "post",
    findOneAndRemove: false,
    findOneAndUpdate: false,
    preMiddleware: authenticateFromHeader,
    preCreate: [
      preCreateGenerateRandomUser,
      addCreatedBy,
      preCreateAddOGData,
      preCreateAutoUpvote,
      preCreateDefaultCommunity,
      preCreatePostBlockBannedUser,
    ],
    preDelete: doSoftDelete,
    postRead: postReadPost,
    preUpdate: authorizeWrites,
    postCreate: [postCreateUpdateAuthorKarmaPost, postCreateGenerateDynamicLink, postCreateNotifyFollowers],
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
      let user_id
      if (req.user) {
        user_id = req.user._id;
      }
      else if (req.is_anonymous) {
        user_id = 'anonymous'
      }
      else {
        return res.boom.unauthorized("User needs to be authenticated to vote!");
      }
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
    });

  router.post(
    `${postUri}/:id/remove`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to remove!"
        );
      }
      const user_id = req.user._id;
      const reason = req.body.reason;
      let post = await Post.findOne({ _id: req.params.id });
      if (!post) return res.boom.badRequest("bad post Id");
      let communityAdmins = await CommunityMembership.findOne({
        "community._id": post?.community?._id,
        "member._id": user_id,
        isAdmin: true,
      });
      if (!communityAdmins)
        return res.boom.unauthorized("You are not authorized to remove");

      post.isRemoved = true;
      post = await post.save();
      return res.json(post);
    }
  );
  router.post(
    `${postUri}/:id/pin`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to remove!"
        );
      }
      const user_id = req.user._id;
      const reason = req.body.reason;
      let post = await Post.findOne({ _id: req.params.id });
      if (!post) return res.boom.badRequest("bad post Id");
      let communityAdmins = await CommunityMembership.findOne({
        "community._id": post?.community?._id,
        "member._id": user_id,
        isAdmin: true,
      });
      if (!communityAdmins)
        return res.boom.unauthorized("You are not authorized to pin");

      post.isPinned = true;
      post = await post.save();
      return res.json(post);
    }
  );
  router.post(
    `${postUri}/:id/unpin`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to remove!"
        );
      }
      const user_id = req.user._id;
      const reason = req.body.reason;
      let post = await Post.findOne({ _id: req.params.id });
      if (!post) return res.boom.badRequest("bad post Id");
      let communityAdmins = await CommunityMembership.findOne({
        "community._id": post?.community?._id,
        "member._id": user_id,
        isAdmin: true,
      });
      if (!communityAdmins)
        return res.boom.unauthorized("You are not authorized to unpin");

      post.isPinned = false;
      post = await post.save();
      return res.json(post);
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
    preCreate: [
      preCreateGenerateRandomUser,
      addCreatedBy,
      preCreateCommentBlockBannedUsers,
      preCreateAddCommentMeta,
    ],
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
    `${commentUri}/:id/remove`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to remove!"
        );
      }
      const user_id = req.user._id;
      const reason = req.body.reason;
      let comment = await Comment.findOne({ _id: req.params.id });
      if (!comment) return res.boom.badRequest("bad comment Id");
      let post = await Post.findOne({ _id: comment.post });
      let communityAdmins = await CommunityMembership.findOne({
        "community._id": post?.community?._id,
        "member._id": user_id,
        isAdmin: true,
      });
      if (!communityAdmins)
        return res.boom.unauthorized("You are not authorized to remove");

      comment.isRemoved = true;
      comment = await comment.save();
      return res.json(comment);
    }
  );

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
      let user_id
      if (req.user) {
        user_id = req.user._id;
      }
      else if (req.is_anonymous) {
        user_id = 'anonymous'
      }
      else {
        return res.boom.unauthorized("User needs to be authenticated to vote!");
      }
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
    }
  );
}
