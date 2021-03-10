import Joi from "joi";
import { logger } from "../../helpers/logger";
import { getUserVote } from "./helpers";
import { groupBy, sortBy } from "lodash";
import { Post, Comment, User } from "../../models";
/**
 * 
 * @param req 
 * @param res 
 * 
 * This function takes  
 * limit as the maximum number of comments at a level to fetch.
 * depth as the maximum depth at to which data would be fetched.
 * path is the pagination parameter used for more comments because of the limit
 */ 
export async function commentTreeBuilder(req, res) {
  const schema = Joi.object({
    post_id: Joi.string().required(),
    limit: Joi.number().default(10),
    depth: Joi.number().default(10),
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

  let { error, value } = schema.validate(req.params, options);
  if (error) {
    return res.boom.badRequest(error);
  }
  let { limit, depth, page, post_id } = value;

  if (limit > 100) limit = 100;
  if (depth > 10) depth = 10;

  logger.debug(`creating comment tree for ${post_id}`);

  // TODO: can be optimized for memory by doing more db calls
  // can be optimized later
  let comments: any[] = await Comment.find({
    post: post_id,
    level: { $lte: depth },
  })
    // .limit(limit)
    .lean();
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
      replies = sortBy(replies, ["voteCount"]);
      comment.replies = replies;
    }
  }

  replies = sortBy(replies, ["voteCount"]);
  replies.forEach((reply) => fillRepliesTillDepth(reply, depth));

  return res.json(replies);
}
