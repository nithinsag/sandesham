import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { registerExtraRoutes } from "../helpers/roueUtils";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { User, Community, Post, Comment } from "../models";
import restify from "express-restify-mongoose";
import {registerRoutes as registerUploadRoutes} from './upload'
import { registerRoutes as registerUserRoutes } from "./user";
import {registerRoutes as registerPostRoutes} from "./post"
import {registerRoutes as registerMessageRoutes} from "./message"

export function registerRoutes(router: Router) {
  registerUploadRoutes(router)
  registerUserRoutes(router)
  registerPostRoutes(router)
  registerMessageRoutes(router)

  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });


}
