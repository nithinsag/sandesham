import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { logger } from "../../helpers/logger";
import { Post, Comment, User } from "../../models";
import { getOGData } from "../../helpers/openGraphScraper";
import { addJobs } from "../../asyncJobs";
import { PushMessageJob } from "../../asyncJobs/worker";
export async function addOGData(req, res, next) {
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

export function addCurrentUserVote(req, res, next) {
  if (!req.user) return next();
  let result = req.erm.result;
  const statusCode = req.erm.statusCode; // 200
  if (!isArray(result)) {
    result = [result];
  }
  result.forEach((post) => (post.userVote = getUserVote(post, req.user)));
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
export async function updatePostKarma(user, increment) {
  return User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { postKarma: increment } }
  );
}
export async function updateCommentKarma(user, increment) {
  return User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { commentKarma: increment } }
  );
}

export function addCommentMeta(req, res, next) {
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
    req.parentComment = parentComment;
    req.parentPost = parentPost;

    next();
  }
  wrapper();
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
export async function updatePostCommentCount(req, res, next) {
  const post_id = req.erm.result.post;
  let updatedPost = await Post.findOneAndUpdate(
    { _id: post_id },
    { $inc: { commentCount: 1 } },
    { new: true }
  );

  next();
}

export async function updateParentCommentCount(req, res, next) {
  await Comment.findOneAndUpdate(
    { _id: req.erm.result.parent },
    { $push: { children: req.erm.result._id } }
  );
  next();
}

export async function sendMessageNotification(req, res, next) {
  let post = req.erm.result.post;
  let parent = req.erm.result.parent;
  let to;
  if (parent) {
    let parentComment = await Comment.findById(parent);
    to = parentComment?.author._id;
  } else {
    let postDoc = await Post.findById(post);
    to = postDoc?.author._id;
  }
  let notification: PushMessageJob = {
    to: to,
    title: "Someone replied",
    message: `Someone replied to your ${parent ? "comment" : "post"}`,
    data: { type: "comment", comment: req.erm.result },
  };
  await addJobs(notification);
  next();
}
