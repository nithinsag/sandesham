import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { logger } from "../../helpers/logger";
import { Post, Comment, User, CommunityMembership } from "../../models";
import { getOGData } from "../../helpers/openGraphScraper";
import { createNotification } from "../../asyncJobs";
import { PushMessageJob } from "../../asyncJobs/worker";
export async function preCreateAddOGData(req, res, next) {
  if (req.body.type === "link") {
    // returning early as we don't want to block return
    // TODO: use a queue for this
    try {
      let result = await getOGData(req.body.link);
      if (result.success) {
        logger.info("updating post with og data");
        req.body.ogData = result;
      }
      next();
    } catch (e) {
      console.log(e);
      next();
    }
  } else next();
}

export async function preCreateDefaultCommunity(req, res, next) {
  if (!req.body?.community?._id) {
    // returning early as we don't want to block return
    // TODO: use a queue for this
    req.body.community = {
      name: "general",
      _id: process.env.DEFAULT_COMMUNITY_ID,
    };
    logger.info(req.body);
    return next();
  }
  return next();
}
export async function preCreateCommentBlockBannedUsers(req, res, next) {
  if (req.body?.post) {
    let post = await Post.findOne({ _id: req.body.post });
    let membership = await CommunityMembership.findOne({
      "member._id": req.user._id,
      "community._id": post?.community?._id,
      isBanned: true,
    });
    if (membership) return res.boom.unauthorized("You are banned from posting");
  }
  return next();
}
export async function preCreatePostBlockBannedUser(req, res, next) {
  if (req.body?.community?._id) {
    let membership = await CommunityMembership.findOne({
      "member._id": req.user._id,
      "community._id": req.body.community._id,
      isBanned: true,
    });
    if (membership) return res.boom.unauthorized("You are banned from posting");
  }
  return next();
}

export function postReadPost(req, res, next) {
  let result = req.erm.result;
  if (!isArray(result)) {
    result = [result];
  }
  result.forEach((post) => {
    if (req.user) post.userVote = getUserVote(post, req.user);
    post = redactDeletedPost(post);
  });
  return next();
}
export function postReadComment(req, res, next) {
  let result = req.erm.result;
  if (!isArray(result)) {
    result = [result];
  }
  result.forEach((comment) => {
    comment.userVote = getUserVote(comment, req.user);
    comment = redactDeletedPost(comment);
  });
  return next();
}
export function preCreateAutoUpvote(req, res, next) {
  let user_id = req.user._id;
  req.body.upvotes = [user_id];
  return next();
}

export function getVoteQuery(user_id, type: number) {
  const voteCountQuery = {
    $set: {
      voteCount: {
        // checking if already voteup, then do nothing, else inc votecount
        $subtract: [{ $size: "$upvotes" }, { $size: "$downvotes" }],
      },
    },
  };
  if (type == -1) type = 2; // -1 is downvote index :2 TODO: better abstraction

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
}
export async function updatePostKarma(user_id, increment) {
  return User.findOneAndUpdate(
    { _id: user_id },
    { $inc: { postKarma: increment } }
  );
}
export async function updateCommentKarma(user_id, increment) {
  return User.findOneAndUpdate(
    { _id: user_id },
    { $inc: { commentKarma: increment } }
  );
}

export function preCreateAddCommentMeta(req, res, next) {
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
      req.body.ancestors = [...parentComment.ancestors, parentComment._id];
    } else {
      req.body.level = 0;
    }
    let user_id = req.user._id;
    req.body.upvotes = [user_id];

    req.parentComment = parentComment;
    req.parentPost = parentPost;
    req.body.community = parentPost.community;
    next();
  }
  wrapper(); //  wrapping to use async await
}

export function ObjectIdToString(objectId) {
  if (typeof objectId === "object") return objectId.toString();
  return objectId;
}

export function getUserVote(document, user) {
  let user_id = user._id.toString();
  let userVote = 0;
  if (includes(map(document.upvotes, ObjectIdToString), user_id)) userVote = 1;
  if (includes(map(document.downvotes, ObjectIdToString), user_id))
    userVote = -1;
  logger.info("no vote yet!" + userVote);
  return userVote;
}
/**
 * post create hook on comments that updates the post votecount
 * @param req
 * @param res
 * @param next
 */
export async function postCreateUpdatePostCommentCount(req, res, next) {
  const post_id = req.erm.result.post;
  let updatedPost = await Post.findOneAndUpdate(
    { _id: post_id },
    { $inc: { commentCount: 1 } },
    { new: true }
  );

  next();
}

export async function postCreateUpdateParentCommentCount(req, res, next) {
  await Comment.findOneAndUpdate(
    { _id: req.erm.result.parent },
    { $push: { children: req.erm.result._id } }
  );
  next();
}

export async function postCreateUpdateAuthorKarmaPost(req, res, next) {
  await updatePostKarma(req.erm.result.author._id, 1);
  next();
}
export async function postCreateUpdateAuthorKarmaComment(req, res, next) {
  await updateCommentKarma(req.erm.result.author._id, 1);
  // add + 1 comment karma to the parent and post authors
  let parent = req.erm.result.parent;
  if (parent) {
    let parentComment = await Comment.findOne({ _id: parent });
    await updateCommentKarma(parentComment?.author._id, 1);
  }
  let post = await Post.findOne({ _id: req.erm.result.post });
  await updatePostKarma(post?.author._id, 1);
  next();
}
export async function postCreateNotifyMods(req, res, next) {
  let post = req.erm.result;
  let admin = await CommunityMembership.findOne({
    isAdmin: true,
    "community._id": post.community._id,
  });
  if (admin && !req.user._id.equals(admin.member._id)) {
    await createNotification({
      title: `New post in ${admin.community.name}!`,
      to: admin.member._id,
      message: `${req.user.displayname} posted in ${admin.community.name}`,
      data: { link: `/post/${post._id}`, type: "post" },
    });
  }
  next();
}

/**
 * middleware for sending message to parent and comment owner once
 * someone posts a comment.
 * @param req
 * @param res
 * @param next
 */
export async function sendCommentNotification(req, res, next) {
  let post = req.erm.result.post;
  let postDoc = await Post.findById(post);
  let postLink = `/post/${post._id}`;
  let parent = req.erm.result.parent;
  let to;
  let author = req.erm.result.author;
  if (parent) {
    let parentComment = await Comment.findById(parent);
    to = parentComment?.author._id;
  } else {
    to = postDoc?.author._id;
  }
  let notification: PushMessageJob = {
    to: to,
    title: `You have a comment!`,
    message: `${author.displayname} replied to your ${
      parent ? "comment" : "post"
    }`,
    data: {
      type: "comment",
      link: postLink,
      detailedLink: `${postLink}/comment/${req.erm._id}`,
    },
  };
  await createNotification(notification);
  next();
}

export async function sendVoteNotificationPost(doc, vote, from) {
  // don't notify cancellations
  if (vote == 0) return;
  let to = doc.author._id;

  // don't notify yourself
  if (to.equals(from)) return;
  let postLink = `/post/${doc._id}`;
  let notification: PushMessageJob = {
    to: to,
    title: `Your post is getting noticed!`,
    message: `You received ${
      vote > 0 ? "an upvote" : "a downvote"
    } on your post`,
    data: { type: "vote", link: postLink },
  };
  await createNotification(notification);
}
export async function sendVoteNotificationComment(doc, vote, from) {
  // don't notify cancellations
  if (vote == 0) return;
  // don't notify yourself
  let to = doc.author._id;
  if (to.equals(from)) return;
  let postLink = `/post/${doc.post}`;
  let notification: PushMessageJob = {
    to: to,
    title: `Your comment is getting noticed!`,
    message: `You received ${
      vote > 0 ? "an upvote" : "a downvote"
    } on your comment`,
    data: { type: "vote", link: postLink },
  };
  await createNotification(notification);
}

export async function doSoftDelete(req, res, next) {
  if (!req.erm.document.author._id.equals(req.user._id)) {
    return res.boom.unauthorized("Only author can delete");
  }
  req.erm.document.deletedAt = new Date();
  req.erm.document.isDeleted = true;
  await req.erm.document.save();
  return res.sendStatus(204);
}
export async function authorizeWrites(req, res, next) {
  if (!req.erm.document.author._id.equals(req.user._id)) {
    return res.boom.unauthorized("Only author can update");
  }
  return next();
}

export function redactDeletedPost(post) {
  if (post.isDeleted) {
    post.title = "Deleted";
    post.description = "Deleted";
    post.link = "Deleted";
    post.ogData = {};
    (post.author._id = null), (post.description = "Deleted");
  }
  return post;
}

export function redactDeletedComment(comment) {
  if (comment.isDeleted || comment.isRemoved) {
    comment.text = "Deleted";
    comment.author._id = null;
    comment.author.displayName = "deleted";
  }
  return comment;
}
