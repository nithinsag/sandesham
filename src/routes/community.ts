import {
  Post,
  Community,
  CommunityMembership,
  CommunityBans,
  CommunityMods,
  User,
} from "../models";
import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import restify from "express-restify-mongoose";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";

export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/community/";

  router.post(
    `${API_BASE_URL}:id/join`,
    authenticateFromHeader,
    async (req, res) => {}
  );
  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });
}
