import { groupBy, includes, isArray, map, sortBy } from "lodash";
import { logger } from "../../helpers/logger";
import { Post, Comment, User } from "../../models";
import { getOGData } from "../../helpers/openGraphScraper";

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

export function addCommentLevel(req, res, next) {
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

export async function updatePostCommentCount(req, res, next) {
  await Post.findOneAndUpdate(
    { _id: req.parentPost._id },
    { $inc: { commentCount: 1 } }
  );
  next();
}
