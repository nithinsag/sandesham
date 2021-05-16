import { Post, Community, CommunityMembership } from "../models";
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
  async function postCreateAutoAdmin(req, res, next) {
    let community = req.erm.result;
    let membership = new CommunityMembership({
      community: { _id: community._id, name: community.name },
      moderator: { _id: req.user._id, displayname: req.user.displayname },
      isAdmin: true,
    });
    await membership.save();
    next();
  }
  async function postReadPopulateCommunityData(req, res, next) {
    const result = req.erm.result; // unfiltered document, object or array
    const statusCode = req.erm.statusCode; // 200
    if (!Array.isArray(result)) {
      let memberCount = await CommunityMembership.countDocuments({
        "community._id": result._id,
      });

      let adminCommunities = (
        await CommunityMembership.find({
          "community._id": result._id,
          isAdmin: true,
        })
      ).map((o) => o.member);
      result.memberCount = memberCount;
      result.admins = adminCommunities;
    }
    next();
  }
  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
    postCreate: postCreateAutoAdmin,
    postRead: postReadPopulateCommunityData,
  });
}
