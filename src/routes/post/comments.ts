import Joi from "joi";
import { logger } from "../../helpers/logger";
import { getUserVote, redactDeletedComment } from "./helpers";
import { groupBy, sortBy } from "lodash";
import { Post, Comment, User, IComment } from "../../models";
/**
 *
 * @param req
 * @param res
 *
 * This function takes
 * limit as the maximum number of comments at a level to fetch.
 * depth as the maximum depth at to which data would be fetched.
 * path is the pagination parameter used for more comments because of the limit
 *
 * We first query the top first level comments with the limit.
 *
 * Next we query the subtree of the top level commit with the required depth parameter
 *
 * Thus we have pagination on top level comment and a control on the max depth.
 *
 */
export async function commentTreeBuilder(req, res) {
  const schema = Joi.object({
    post_id: Joi.string().required(),
    comment_id: Joi.string(),
    limit: Joi.number().default(100),
    depth: Joi.number().default(15),
    page: Joi.number().default(1),
  });
  // https://mongodb-documentation.readthedocs.io/en/latest/use-cases/storing-comments.html#gsc.tab=0
  // http://www.sitepoint.com/hierarchical-data-database/
  // schema options
  const options = {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  };

  // validate request body against schema
  // validate request body against schema

  let { error, value } = schema.validate(
    { ...req.query, ...req.params },
    options
  );
  if (error) {
    return res.boom.badRequest(error);
  }
  let { limit, depth, page, post_id, comment_id } = value;

  if (limit > 100) limit = 100;
  if (depth > 15) depth = 15;
  let maxDepth = depth;
  logger.debug(`creating comment tree for ${post_id}`);

  let baseQuery;
  if (comment_id) {
    let rootComment = await Comment.findOne({ _id: comment_id });

    if (!rootComment) {
      return res.boom.badRequest("invalid parent comment");
    }
    maxDepth = rootComment.level + depth;
    baseQuery = { parent: rootComment?._id };
  } else {
    baseQuery = {
      post: post_id,
      level: 0,
    };
  }

  let comments: IComment[] = await Comment.find(baseQuery)
    .limit(limit)
    .skip((page - 1) * limit)
    .sort("voteCount")
    .lean();

  let topComments = comments.map((o) => o._id);

  let children: IComment[] = await Comment.find({
    ancestors: { $in: topComments },
    level: { $lt: maxDepth },
  })
    .sort("voteCount")
    .lean();

  let allComments = [...comments, ...children];
  let commentIndex = {};
  // building comment lookup table
  allComments.forEach((o) => {
    if (req.user) {
      o.userVote = getUserVote(o, req.user);
    }
    o = redactDeletedComment(o);
    o = commentIndex[o._id] = o;
  });

  // recursively build up the tree
  function buildCommentTree(comment) {
    let replies: IComment[] = [];
    for (let i = 0; i < comment.children.length; i++) {
      let childComment = commentIndex[comment.children[i]];
      if (childComment) {
        buildCommentTree(childComment);
        replies.push(commentIndex[comment.children[i]]);
      }
    }
    comment.replies = replies;
  }

  let commentTree = comments.forEach((o) => {
    buildCommentTree(o);
  });
  return res.json(comments);
}
