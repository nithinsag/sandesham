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
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to join community"
        );
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let communityMembership = new CommunityMembership({
        community: { name: community.modelName, _id: community.id },
        member: { displayname: req.user.displayname, _id: req.user._id },
      });
      await communityMembership.save();
      res.json(communityMembership);
    }
  );
  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });
}
