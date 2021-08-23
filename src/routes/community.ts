import {
  Post,
  Comment,
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
import { createNotification } from "../asyncJobs";
import { PushMessageJob } from "../asyncJobs/worker";
import mongoose from "mongoose";
export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/community/";

  router.get(
    `${API_BASE_URL}byName`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.query.name)
        return res.boom.badRequest("name is a required parameter");
      let community = await Community.findOne({
        name: { $regex: new RegExp(`^${req.query.name}$`, "i") },
      });
      if (community) {

        return res.json({ name: community.name, _id: community._id });
      }
      else {
        return res.json(community);
      }
    }
  );
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
      let membership = await CommunityMembership.findOne({
        "community._id": community._id,
        "member._id": req.user._id,
      });
      // if user is banned then membership already exists and we don't do anything
      if (membership) return res.json(true);
      let communityMembership = new CommunityMembership({
        community: { name: community.name, _id: community._id },
        member: { displayname: req.user.displayname, _id: req.user._id },
      });
      try {
        await communityMembership.save();
      } catch (e) {
        return res.boom.badData("cannot create membership", e);
      }
      let admins = await CommunityMembership.find({
        isAdmin: true,
        "community._id": community._id,
        subscribeToAdminNotification: true,
      });
      for (let admin of admins) {
        await createNotification({
          title: `${community.name} is growing!`,
          to: admin.member._id,
          message: `${req.user.displayname} joined ${community.name}`,
          data: { link: `/community/${community._id}`, type: "community" },
        });
      }
      res.json(communityMembership);
    }
  );
  router.get(
    `${API_BASE_URL}filter`,
    authenticateFromHeader,
    async (req, res) => {
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let matchQuery: any = {};
      let context = req.query.context || "popular";
      if (req.user && context == "home") {
        let memberCommunities = (
          await CommunityMembership.find({ "member._id": req.user._id })
        ).map((m) => m.community._id);

        matchQuery = { _id: { $in: memberCommunities } };
      }
      let aggregateQuery = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "communitymemberships",
            localField: "_id",
            foreignField: "community._id",
            as: "memberCount",
          },
        },
        {
          $lookup: {
            from: "posts",
            let: { communityId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$community._id", "$$communityId"],
                      },
                      {
                        $gte: [
                          "$created_at",
                          new Date(
                            new Date().getTime() - 7 * 24 * 60 * 60 * 1000
                          ),
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            as: "postCount",
          },
        },
        {
          $addFields: {
            memberCount: { $size: "$memberCount" },
            postCount: { $size: "$postCount" },
          },
        },
        { $sort: { score: -1 } },
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
  router.get(`${API_BASE_URL}top`, authenticateFromHeader, async (req, res) => {
    let memberCommunities: any = [];
    if (req.user) {
      memberCommunities = (
        await CommunityMembership.find({ "member._id": req.user._id })
      ).map((m) => m.community._id);
    }
    let page = parseInt(req.query.page) || 1;
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
      {
        $lookup: {
          from: "posts",
          let: { communityId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$community._id", "$$communityId"],
                    },
                    {
                      $gte: [
                        "$created_at",
                        new Date(
                          new Date().getTime() - 7 * 24 * 60 * 60 * 1000
                        ),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "postCount",
        },
      },
      {
        $addFields: {
          memberCount: { $size: "$memberCount" },
          postCount: { $size: "$postCount" },
        },
      },
      { $sort: { score: -1 } },
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
    `${API_BASE_URL}:id/searchMembersByName`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let membership = await CommunityMembership.findOne({
        "member._id": req.user._id,
        isAdmin: true,
      });
      if (!membership)
        return res.boom.badRequest(
          "user need to be admin of a community to search users"
        );

      let page = parseInt(String(req.query.page)) || 1;
      let limit = parseInt(String(req.query.limit)) || 10;
      let name = req.query.displayname || "";
      let matchQuery = {
        "member.displayname": {
          $regex: `${name}`,
          $options: "ig",
        },
        "community._id": community._id,
      };
      let aggregateQuery = [
        {
          $match: matchQuery,
        },
        { $sort: { created_at: -1 } },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                {
                  membership_id: "$_id",
                  isAdmin: "$isAdmin",
                  isBanned: "$isBanned",
                },
                "$member",
              ],
            },
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
      let communityMembers = await CommunityMembership.aggregate(
        aggregateQuery
      );
      return res.json(communityMembers[0]);
    }
  );
  router.get(
    `${API_BASE_URL}:id/leaderboard`,
    authenticateFromHeader,
    async (req, res) => {
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let sort = req.query.sort || "postVote";
      const validSorts = ["comment", "post", "postVote", "commentVote"];
      if (!validSorts.includes(sort))
        return res.boom.badRequest(
          `sort should be one of ${validSorts.join(", ")}.`
        );
      let page = parseInt(String(req.query.page)) || 1;
      let limit = parseInt(String(req.query.limit)) || 10;
      let matchQuery: any = {
        "community._id": community._id,
        isDeleted: false,
        isRemoved: false,
      };
      if (req.query.from) {
        matchQuery = {
          created_at: { $gte: new Date(parseInt(req.query.from)) },
          ...matchQuery,
        };
      }
      // allow leaderboard by postkarma, commenkarma, commentcount
      let aggregateQuery = [
        {
          $match: matchQuery,
        },
        {
          $group: {
            _id: "$author._id",
            voteCount: { $sum: "$voteCount" },
            count: { $sum: 1 },
            displayname: { $first: "$author.displayname" },
          },
        },
        { $sort: { [sort.includes("Vote") ? "voteCount" : "count"]: -1 } },
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

      let commentGroupQuery = {
        $group: {
          _id: "$author._id",
          voteCount: { $sum: "$voteCount" },
          commentCount: { $sum: "commentCount" },
          displayname: { $first: "$author.displayname" },
        },
      };
      let leaderboard;

      if (sort.startsWith("post"))
        leaderboard = await Post.aggregate(aggregateQuery);
      else leaderboard = await Comment.aggregate(aggregateQuery);
      return res.json(leaderboard[0]);
    }
  );
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
            newRoot: {
              $mergeObjects: [
                {
                  membership_id: "$_id",
                  isAdmin: "$isAdmin",
                  isBanned: "$isBanned",
                },
                "$member",
              ],
            },
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
  router.get(
    `${API_BASE_URL}:id/bannedMembers`,
    authenticateFromHeader,
    async (req, res) => {
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;

      let aggregateQuery = [
        {
          $match: {
            "community._id": mongoose.Types.ObjectId(req.params.id),
            isBanned: true,
          },
        },
        { $sort: { created_at: -1 } },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                {
                  membership_id: "$_id",
                  isAdmin: "$isAdmin",
                  isBanned: "$isBanned",
                },
                "$member",
              ],
            },
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
        // TODO: do soft delete
        let communityMembership = await CommunityMembership.findOneAndDelete({
          "community._id": req.params.id,
          "member._id": req.user._id,
          isBanned: false,
        });
        // if member is banned we don't do anything and return false
        // banned members will not see join and leave buttons
        if (communityMembership) {
          return res.json(true);
        } else {
          return res.json(false);
        }
      } catch (e) {
        logger.error(e);
        return res.json(false);
      }
    }
  );
  router.post(
    `${API_BASE_URL}:id/unfavorite`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to unfavorite community"
        );

      try {
        let communityMembership = await CommunityMembership.findOne({
          "community._id": req.params.id,
          "member._id": req.user._id,
          isFavorite: true,
        });
        // if member is banned we don't do anything and return false
        // banned members will not see join and leave buttons
        if (communityMembership) {
          communityMembership.isFavorite = false;
          await communityMembership.save();
          return res.json(true);
        } else {
          // community is not favorited
          return res.json(true);
        }
      } catch (e) {
        logger.error(e);
        return res.json(false);
      }
    }
  );
  router.post(
    `${API_BASE_URL}:id/favorite`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to favorite community"
        );

      try {
        let communityMembership = await CommunityMembership.findOne({
          "community._id": req.params.id,
          "member._id": req.user._id,
          isBanned: false,
        });
        // if member is banned we don't do anything and return false
        // banned members will not see join and leave buttons
        if (communityMembership) {
          communityMembership.isFavorite = true;
          await communityMembership.save();
          return res.json(true);
        } else {
          return res.boom.badRequest(
            "User needs to be member of community to favorite"
          );
        }
      } catch (e) {
        logger.error(e);
        return res.json(false);
      }
    }
  );
  router.post(
    `${API_BASE_URL}:id/toggleAdminNotifications`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to toggle notifications"
        );

      try {
        let communityMembership = await CommunityMembership.findOne({
          "community._id": req.params.id,
          "member._id": req.user._id,
          isAdmin: true,
          isBanned: false,
        });
        // if member is banned we don't do anything and return false
        // banned members will not see join and leave buttons
        if (communityMembership) {
          communityMembership.subscribeToAdminNotification =
            !communityMembership.subscribeToAdminNotification;
          await communityMembership.save();
          return res.json(communityMembership.subscribeToAdminNotification);
        } else {
          return res.boom.badRequest("user is not an admin of the community");
        }
      } catch (e) {
        logger.error(e);
        return res.json(false);
      }
    }
  );
  router.post(
    `${API_BASE_URL}:id/togglePostNotification`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest(
          "user needs to be authenticated to toggle notifications"
        );

      try {
        let communityMembership = await CommunityMembership.findOne({
          "community._id": req.params.id,
          "member._id": req.user._id,
        });
        // if member is banned we don't do anything and return false
        // banned members will not see join and leave buttons
        if (communityMembership) {
          communityMembership.disablePostNotification =
            !communityMembership.disablePostNotification;
          await communityMembership.save();
          return res.json(communityMembership.disablePostNotification);
        } else {
          return res.boom.badRequest("user is not subscribed to the community");
        }
      } catch (e) {
        logger.error(e);
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

      let inviteeMemebership = await CommunityMembership.findOne({
        "member._id": to._id,
        "community._id": community._id,
      });
      if (inviteeMemebership) {
        // return early if already member
        return res.json(true);
      }
      let notification: PushMessageJob;
      notification = {
        to: to._id,
        title: `You recieved an invite!`,
        message: `${req.user.displayname} invited you to join ${community.name}`,
        data: { type: "community", link: `/community/${community._id}` },
      };
      await createNotification(notification);
      return res.json(true);
    }
  );
  router.post(
    `${API_BASE_URL}:id/addAsAdmin/:user`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let adminship = await CommunityMembership.findOne({
        "member._id": req.user._id,
        isAdmin: true,
      });
      if (!adminship)
        return res.boom.badRequest(
          "user need to be admin of a community to add another admin"
        );
      let membership;

      try {
        membership = await CommunityMembership.findOne({
          "community._id": community._id,
          "member._id": req.params.user,
        });

        if (!membership) {
          return res.boom.badRequest("Could not make a non member admin");
        }
        if (membership.isAdmin) {
          return res.boom.badRequest("User is already an admin");
        }

        membership.isAdmin = true;
        await membership.save();
      } catch (e) {
        return res.boom.badData("cannot make admin", e);
      }
      res.json(true);

      let admins = await CommunityMembership.find({
        isAdmin: true,
        "community._id": community._id,
        subscribeToAdminNotification: true,
      });

      admins.forEach(async (admin) => {
        let notification: PushMessageJob;
        notification = {
          to: admin._id,
          title: `New admin alert`,
          message: `${membership?.member.displayname
            } was promoted as an admin for ${community!.name}`,
          data: { type: "community", link: `/community/${community!._id}` },
        };
        await createNotification(notification);
      });
    }
  );
  router.post(
    `${API_BASE_URL}:id/dismissAsAdmin/:user`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let adminship = await CommunityMembership.findOne({
        "member._id": req.user._id,
        isAdmin: true,
      });
      if (!adminship)
        return res.boom.badRequest(
          "user need to be admin of a community to dissmiss another admin"
        );
      let membership;
      try {
        membership = await CommunityMembership.findOne({
          "community._id": community._id,
          "member._id": req.params.user,
          isAdmin: true,
        });

        if (!membership) {
          return res.boom.badRequest("Could not find specified admin user");
        }

        membership.isAdmin = false;
        await membership.save();
      } catch (e) {
        return res.boom.badData("could not dismiss as admin", e);
      }
      res.json(true);

      let admins = await CommunityMembership.find({
        isAdmin: true,
        "community._id": community._id,
        subscribeToAdminNotification: true,
      });

      admins.forEach(async (admin) => {
        let notification: PushMessageJob;
        notification = {
          to: admin._id,
          title: `User dismissed as admin`,
          message: `${membership?.member.displayname
            } was dismissed as admin of ${community!.name}`,
          data: { type: "community", link: `/community/${community!._id}` },
        };
        await createNotification(notification);
      });
    }
  );

  router.post(
    `${API_BASE_URL}:id/ban/:user`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let membership = await CommunityMembership.findOne({
        "member._id": req.user._id,
        isAdmin: true,
      });
      if (!membership)
        return res.boom.badRequest(
          "user need to be admin of a community to ban another user"
        );

      try {
        let membership = await CommunityMembership.findOne({
          "community._id": community._id,
          "member._id": req.params.user,
          isAdmin: false,
        });
        if (!membership) {
          return res.boom.badRequest("Could not find non admin user to ban");
        }

        membership.isBanned = true;
        await membership.save();
      } catch (e) {
        return res.boom.badData("cannot ban", e);
      }
      return res.json(true);
    }
  );

  router.post(
    `${API_BASE_URL}:id/unban/:user`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.badRequest("user needs to be authenticated");
      let community = await Community.findOne({ _id: req.params.id });
      if (!community) return res.boom.badRequest("invalid community id");
      let membership = await CommunityMembership.findOne({
        "member._id": req.user._id,
        isAdmin: true,
      });
      if (!membership)
        return res.boom.badRequest(
          "user need to be admin of a community to unban another user"
        );

      try {
        let membership = await CommunityMembership.findOne({
          "community._id": community._id,
          "member._id": req.params.user,
          isBanned: true,
        });
        if (!membership) {
          return res.boom.badRequest("Could not find banned user");
        }

        membership.isBanned = false;
        await membership.save();
      } catch (e) {
        return res.boom.badData("cannot ban", e);
      }
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
  async function postReadPopulateMembershipData(req, res, next) {
    let result = req.erm.result; // unfiltered document, object or array
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
      if (req.user) {
        let membership = await CommunityMembership.findOne({
          "community._id": result._id,
          "member._id": req.user._id,
        });
        if (membership) {
          let { member, community, ...rest } = membership.toObject();
          result.membership = rest;
        }
      }
      result.memberCount = memberCount;
      result.admins = adminCommunities;
      req.erm.result = result;
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
    postRead: postReadPopulateMembershipData,
  });
}
