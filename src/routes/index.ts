import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { User, Community, Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import { registerRoutes as registerUploadRoutes } from "./upload";
import { registerRoutes as registerUserRoutes } from "./user";
import { registerRoutes as registerPostRoutes } from "./post";
import { registerRoutes as registerMessageRoutes } from "./message";
import { registerRoutes as registerNotificationRoutes } from "./notification";
import { registerRoutes as registerUtilityRoutes } from "./utilities";
import { registerRoutes as registerCommunityRoutes } from "./community";
import { registerRoutes as registerTagRoutes } from "./tags";
import { registerRoutes as registerFeedRoutes } from "./feed";

export function registerRoutes(router: Router) {
  registerUploadRoutes(router);
  registerUserRoutes(router);
  registerPostRoutes(router);
  registerMessageRoutes(router);
  registerUtilityRoutes(router);
  registerTagRoutes(router);
  registerNotificationRoutes(router);
  registerCommunityRoutes(router);
  registerFeedRoutes(router);
}
