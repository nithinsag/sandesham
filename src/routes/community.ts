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
        community: { name: community.name, _id: community.id },
        member: { displayname: req.user.displayname, _id: req.user._id },
      });
      await communityMembership.save();
      res.json(communityMembership);
    }
  );
  router.post(
    `${API_BASE_URL}:id/leave`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to join community"
        );

      try {
        let communityMembership = await CommunityMembership.findOneAndDelete({
          "community._id": req.params.id,
          "member._id": req.user._id,
        });
        if (communityMembership) {
          return res.json(true);
        } else {
          return res.json(false);
        }
      } catch (e) {
        logger.debug(e);
        return res.json(false);
      }
    }
  );
  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });
}
