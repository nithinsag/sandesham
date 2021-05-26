import { logger } from "../../helpers/logger";
import { Post, Comment, User } from "../../models";
import { getUserVote, redactDeletedPost } from "./helpers";
import { getFeedHandler as newFeedHandler } from "../feed";
export const getFeedHandler = function (type) {
  return newFeedHandler(type);
};
