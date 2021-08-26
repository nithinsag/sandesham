import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { logger } from "../../helpers/logger";
import { Post, Comment, User, CommunityMembership } from "../../models";
import { getOGData } from "../../helpers/openGraphScraper";
import { createNotification } from "../../asyncJobs";
import { PushMessageJob } from "../../asyncJobs/worker";
import { truncateWithEllipses } from "../../helpers/utils";
import { createDynamicLinkFromPost } from '../../helpers/shortlink'
import _ from 'lodash'

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
  let uniqueCommentors = (
    await await Comment.aggregate([
      { $match: { post: post_id } },
      { $group: { _id: "$author._id", count: { $sum: 1 } } },
    ])
  ).length;
  let updatedPost = await Post.findOneAndUpdate(
    { _id: post_id },
    { $inc: { commentCount: 1 }, $set: { uniqueCommentors: uniqueCommentors } },
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


export async function postCreateGenerateDynamicLink(req, res, next) {
  let shortLink = await createDynamicLinkFromPost(req.erm.result)
  req.erm.result.dynamicLink = shortLink
  await req.erm.result.save();
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
export async function postCreateNotifyFollowers(req, res, next) {
  let post = req.erm.result;
  let admins = await CommunityMembership.find({
    isAdmin: true,
    isBanned: false,
    "community._id": post.community._id,
  });

  for (let admin of admins) {
    if (admin && !req.user._id.equals(admin.member._id)) {
      createNotification({
        title: `New post in ${admin.community.name}!`,
        to: admin.member._id,
        message: `${req.user.displayname} posted in ${admin.community.name}`,
        data: { link: `/post/${post._id}`, type: "post" },
      });
    }
  }

  let subs = await CommunityMembership.find({
    isAdmin: false,
    isBanned: false,
    disablePostNotification: false,
    "community._id": post.community._id,
  });

  for (let sub of subs) {
    if (sub && !req.user._id.equals(sub.member._id)) {
      createNotification({
        title: `${post.author.displayname} @ ${sub.community.name}!`,
        to: sub.member._id,
        message: `${truncateWithEllipses(post.title, 30)}`,
        data: { link: `/post/${post._id}`, type: "post" },
      });
    }
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
  let detailedLink;
  let type;
  let message;
  let author = req.erm.result.author;
  let commentText = req.erm.result.text;
  if (parent) {
    let parentComment = await Comment.findById(parent);
    to = parentComment?.author._id;
    detailedLink = `${postLink}/${req.erm.result.parent}`;
    type = "comment";
    message = parentComment?.text;
  } else {
    to = postDoc?.author._id;
    type = "post";
    detailedLink = `${postLink}/${req.erm.result._id}`;
    message = postDoc?.title;
  }

  // check if there is a tag
  const commentBody = req.erm.result.text;
  let users: any = []
  let matches = commentBody.match(/@\w+/g);
  if (matches) {
    users = matches.map(u => u.replace('@', ''))
  }
  const mentionedUsers = await User.find({ displayname: { $in: users } })
  let mentionedUserIds: any = []
  for (let mentionedUser of mentionedUsers) {
    mentionedUserIds.push(mentionedUser._id.toString())
    let mentionNotification: PushMessageJob = {
      to: mentionedUser._id,
      title: `${author.displayname} mentioned you in a comment`,
      message: `${truncateWithEllipses(commentText, 30)}`,
      data: {
        type: type,
        link: postLink,
        detailedLink: detailedLink,
      },
    };
    await createNotification(mentionNotification);
  }

  if (to.equals(author._id)) return next(); // dont' notify yourself

  if (_.includes(mentionedUserIds, to))
    return next();
  //skipping notification to creator as we are already sending mentioned notification
  let notification: PushMessageJob = {
    to: to,
    title: `You have a comment!`,
    message: `${author.displayname} replied to your ${type} - "${truncateWithEllipses(message, 30)}" `,
    data: {
      type: type,
      link: postLink,
      detailedLink: detailedLink,
    },
  };
  await createNotification(notification);
  next();
}

export async function sendVoteNotificationPost(doc, vote, from) {
  // don't notify cancellations and downvotes
  if (vote < 1) return;
  let to = doc.author._id;

  // don't notify yourself
  if (to.equals(from)) return;
  let postLink = `/post/${doc._id}`;
  let notification: PushMessageJob = {
    to: to,
    title: `Your post is getting noticed!`,
    message: `You received ${vote > 0 ? "an upvote" : "a downvote"
      } on your post - "${truncateWithEllipses(doc.title, 30)}"`,
    data: { type: "vote", link: postLink },
  };
  await createNotification(notification);
}
export async function sendVoteNotificationComment(doc, vote, from) {
  // don't notify cancellations
  if (vote <= 0) return;
  // don't notify yourself
  let to = doc.author._id;
  if (to.equals(from)) return;
  let postLink = `/post/${doc.post}`;
  let notification: PushMessageJob = {
    to: to,
    title: `Your comment is getting noticed!`,
    message: `You received ${vote > 0 ? "an upvote" : "a downvote"
      } on your comment - "${truncateWithEllipses(doc.text, 30)}"`,
    data: {
      type: "vote",
      link: postLink,
      detailedLink: `${postLink}/${doc._id}`,
    },
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
