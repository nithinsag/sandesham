import {
  Post,
  Community,
  CommunityMembership,
  User,
  CommunityCategory,
} from "../models";
import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import restify from "express-restify-mongoose";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";
import { sendNotification } from "../asyncJobs";
import { PushMessageJob } from "../asyncJobs/worker";
import mongoose from "mongoose";
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
        community: { name: community.name, _id: community._id },
        member: { displayname: req.user.displayname, _id: req.user._id },
      });
      try {
        await communityMembership.save();
      } catch (e) {
        res.boom.badData("cannot create membership", e);
      }
      let admin = await CommunityMembership.findOne({
        isAdmin: true,
        "community._id": community._id,
      });
      if (admin) {
        sendNotification({
          title: `${community.name} is growing`,
          to: admin.member._id,
          message: `${req.user.displayname} joined ${community.name}`,
          data: { link: `/community/${community._id}`, type: "community" },
        });
      }
      res.json(communityMembership);
    }
  );
  router.get(`${API_BASE_URL}top`, authenticateFromHeader, async (req, res) => {
    if (!req.user)
      return res.boom.badRequest(
        "user needs to be authenticated to join community"
      );
    let memberCommunities = (
      await CommunityMembership.find({ "member._id": req.user._id })
    ).map((m) => m.community._id);
    let page = req.query.page || 1;
    let limit = parseInt(req.query.limit) || 10;

    let aggregateQuery = [
      { $match: { _id: { $nin: memberCommunities } } },
      {
        $lookup: {
          from: "communitymemberships",
          localField: "_id",
          foreignField: "community._id",
          as: "memberCount",
        },
      },
      { $addFields: { memberCount: { $size: "$memberCount" } } },
      { $sort: { memberCount: -1 } },
      {
        $facet: {
          metadata: [
            { $count: "total" },
            { $addFields: { page: page, limit: limit } },
          ],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    ];

    let communities = await Community.aggregate(aggregateQuery);
    return res.json(communities[0]);
  });
  router.get(
    `${API_BASE_URL}:id/members`,
    authenticateFromHeader,
    async (req, res) => {
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;

      let aggregateQuery = [
        { $match: { "community._id": mongoose.Types.ObjectId(req.params.id) } },
        { $sort: { created_at: -1 } },
        {
          $replaceRoot: {
            newRoot: { $mergeObjects: [{ membership_id: "$_id" }, "$member"] },
          },
        },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              { $addFields: { page: page, limit: limit } },
            ],
            data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        },
      ];
      let communities = await CommunityMembership.aggregate(aggregateQuery);
      return res.json(communities[0]);
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
  router.post(
    `${API_BASE_URL}:id/invite/:user`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let membership = await CommunityMembership.findOne({
        "member._id": req.user._id,
      });
      if (!membership)
        return res.boom.badRequest(
          "user need to be member of a community to invite another user"
        );

      let to = await User.findById(req.params.user);
      if (!to) return res.boom.badRequest("invalid user to invite");

      let notification: PushMessageJob;
      notification = {
        to: to._id,
        title: `You recieved an invite!`,
        message: `${req.user.displayname} invited you to join ${community.name}`,
        data: { type: "community", link: `/community/${community._id}` },
      };
      await sendNotification(notification);
      return res.json(true);
    }
  );
  async function postCreateAutoAdmin(req, res, next) {
    let community = req.erm.result;
    let membership = new CommunityMembership({
      community: { _id: community._id, name: community.name },
      member: { _id: req.user._id, displayname: req.user.displayname },
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
  router.get(
    `${API_BASE_URL}search`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.query.text)
        return res.boom.badRequest("text required to search");

      let page = parseInt(String(req.query.page)) || 1;
      let limit = parseInt(String(req.query.limit)) || 10;

      let aggregateQuery = [
        { $match: { name: { $regex: `${req.query.text}`, $options: "ig" } } },
        {
          $lookup: {
            from: "communitymemberships",
            localField: "_id",
            foreignField: "community._id",
            as: "memberCount",
          },
        },
        { $addFields: { memberCount: { $size: "$memberCount" } } },
        { $sort: { memberCount: -1 } },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              { $addFields: { page: page, limit: limit } },
            ],
            data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        },
      ];
      let communities = await Community.aggregate(aggregateQuery);
      return res.json(communities[0]);
    }
  );
  router.get(
    `${API_BASE_URL}category`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to join community"
        );
      let page = parseInt(String(req.query.page)) || 1;
      let limit = parseInt(String(req.query.limit)) || 10;

      let aggregateQuery = [
        { $match: {} },
        {
          $facet: {
            metadata: [
              { $count: "total" },
              { $addFields: { page: page, limit: limit } },
            ],
            data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        },
      ];
      let communityCategory = await CommunityCategory.aggregate(aggregateQuery);
      return res.json(communityCategory[0]);
    }
  );
  const communityUri = restify.serve(router, Community, {
    name: "community",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
    postCreate: postCreateAutoAdmin,
    postRead: postReadPopulateCommunityData,
  });
}
