import * as admin from "firebase-admin";
import { User, Post, Comment, Community, CommunityMembership } from "../models";
import { validateToken } from "../modules/firebase";
import { extractTokenFromAuthHeader } from "../helpers/roueUtils";
import { Router } from "express";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { authenticateFromHeader } from "../middlewares/authenticate";
import Joi from "joi";
import mongoose from "mongoose";
import { updateUser, userUpdateQue } from "../asyncJobs";

export function registerRoutes(router: Router) {
  const userUri = "/api/v1/user"; // building api url before restify to give higher priority
  // TODO: remove unnecessary function
  router.post(
    `${userUri}/registerMessageToken`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to register token!"
        );
      }

      // create schema object
      const schema = Joi.object({
        pushMessageToken: Joi.string().required(),
      });

      // schema options
      const options = {
        abortEarly: false, // include all errors
        allowUnknown: true, // ignore unknown props
        stripUnknown: true, // remove unknown props
      };

      // validate request body against schema
      const { error, value } = schema.validate(req.body, options);

      if (error) {
        // on fail return comma separated errors
        return res.boom.badRequest("pushMessageToken required");
      }

      let user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { pushMessageToken: req.body.pushMessageToken },
        { new: true }
      );

      return res.json(user);
    }
  );

  router.post(`${userUri}/signup`, async (req, res) => {
    let token = extractTokenFromAuthHeader(req);

    var decodedToken;
    if (process.env.DEPLOY_ENV == "TEST" && token) {
      // If deploy env is test, then send email
      // directly as the authorization header, token validation will be skipped
      decodedToken = {
        name: "Test User",
        picture: "http://example.com/picure.jpg",
        email: token,
        email_verified: true,
      };
    } else {
      decodedToken = await validateToken(token);
    }
    if (typeof decodedToken == "object") {
      const { name, picture, email, email_verified } = decodedToken;
      let users, user;
      users = await User.find({ email: email });
      if (users.length > 0) {
        user = users[0];
        logger.info("user in signup exist: " + JSON.stringify(user));
      } else {
        const displayname = req.body.displayname;
        user = new User({
          name,
          email,
          picture,
          created_at: Date.now(),
          displayname,
        });
        logger.info("user in signup not exist " + JSON.stringify(user));
      }
      try {
        logger.info("creating new user");
        await user.save();
        //res.json(user);
      } catch (e) {
        logger.error("failed to create user");
        logger.error(e.message);
        return res.boom.badRequest(e);
      }
      res.json(user);
    } else {
      res.boom.unauthorized("could not register user");
    }
  });

  router.post(`${userUri}/logout`, authenticateFromHeader, async (req, res) => {
    if (!req.user) {
      return res.boom.unauthorized("User needs to be authenticated to logout");
    }
    //TODO: handle multidevice better
    let user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { pushMessageToken: "", loggedout_at: new Date() },
      { new: true }
    );

    return res.json(user);
  });
  router.post(
    `${userUri}/leaderboard`,
    //authenticateFromHeader,
    async (req, res) => {
      //TODO: handle multidevice better
      let users = await User.aggregate([
        {
          $project: { _id: 1, displayname: 1, voteKarma: 1, commentKarma: 1 },
        },
        {
          $addFields: { karma: { $sum: ["$postKarma", "$commentKarma"] } },
        },
        { $sort: { projectField: -1 } },
      ]);
      return res.json(users);
    }
  );

  router.post(
    `${userUri}/blockUser/:targetUser`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized("User needs to be authenticated");
      }
      let blockedUser = req.params.targetUser;
      let blockedUserId = mongoose.Types.ObjectId(blockedUser);
      let index = req.user.blockedUsers.indexOf(blockedUserId);
      if (index > 0) return res.json(true); // return early as already blocked
      req.user.blockedUsers.push(blockedUserId);
      await req.user.save();
      return res.json(true);
    }
  );

  router.post(
    `${userUri}/unblockUser/:targetUser`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized("User needs to be authenticated");
      }
      let blockedUser = req.params.targetUser;
      let blockedUserId = mongoose.Types.ObjectId(blockedUser);
      let index = req.user.blockedUsers.indexOf(blockedUserId);
      if (index < 0) {
        return res.json(false);
      } else {
        req.user.blockedUsers.splice(index, 1);
        await req.user.save();
        return res.json(true);
      }

      await req.user.save();
      return res.json(true);
    }
  );
  router.get(`${userUri}/self`, authenticateFromHeader, async (req, res) => {
    if (!req.user) {
      return res.json({});
    }
    let user = req.user.toJSON();
    user = await populateCommunityDataOnUser(user);
    res.json(user);
  });

  router.get(
    `${userUri}/:user_id/posts`,
    authenticateFromHeader,
    async (req, res) => {
      let limit = 10;
      let page = 1; // first page as default

      let matchQuery: any = {
        "author._id": mongoose.Types.ObjectId(req.params.user_id),
        isDeleted: false,
      };

      if (req.query && req.query.page) {
        page = parseInt((req.query as any).page);
      }
      if (req.query && req.query.tag) {
        let tag = (req.query as any).tag;
        matchQuery = {
          ...matchQuery,
          tags: tag,
        };
      }
      if (req.query && req.query.limit) {
        if (parseInt((req.query as any).limit) < 100) {
          limit = parseInt((req.query as any).limit);
        }
      }

      let aggregateQuery = [
        { $match: matchQuery },
        {
          $sort: {
            created_at: -1,
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

      let posts = await Post.aggregate(aggregateQuery);
      res.json(posts[0]);
    }
  );

  router.get(
    `${userUri}/:user_id/comments`,
    authenticateFromHeader,
    async (req, res) => {
      let limit = 10;
      let page = 1; // first page as default

      let matchQuery: any = {
        "author._id": mongoose.Types.ObjectId(req.params.user_id),
        isDeleted: false,
      };

      if (req.query && req.query.page) {
        page = parseInt((req.query as any).page);
      }
      if (req.query && req.query.limit) {
        if (parseInt((req.query as any).limit) < 100) {
          limit = parseInt((req.query as any).limit);
        }
      }

      let aggregateQuery = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "posts",
            localField: "post",
            foreignField: "_id",
            as: "postDetail",
          },
        },
        {
          $set: {
            postDetail: { $arrayElemAt: ["$postDetail", 0] },
          },
        },
        {
          $sort: {
            created_at: -1,
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

      let comment = await Comment.aggregate(aggregateQuery);
      res.json(comment[0]);
    }
  );

  router.get(
    `${userUri}/self/communities`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized(
          "User needs to be authenticated to fetch communities"
        );
      }
      let matchQuery: any = {
        "member._id": req.user._id,
        isBanned: false,
      };

      let aggregateQuery = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "communities",
            localField: "community._id",
            foreignField: "_id",
            as: "communityDetail",
          },
        },
        {
          $set: {
            postDetail: { $arrayElemAt: ["$communityDetail", 0] },
          },
        },
        {
          $sort: {
            created_at: -1,
          },
        },
      ];

      let communityMemberships = await CommunityMembership.aggregate(
        aggregateQuery
      );
      res.json(communityMemberships);
    }
  );

  async function postUserUpdateTriggerUpdates(req, res, next) {
    const result = req.erm.result;
    await updateUser({ updatedUser: result._id });
    next();
  }

  async function preUpdateAuthorizeUserUpdate(req, res, next) {
    if (!req.erm.document._id.equals(req.user._id)) {
      return res.boom.unauthorized("you can only update yourself");
    }
    return next();
  }

  async function postReadPopulateCommunityData(req, res, next) {
    let result = req.erm.result; // unfiltered document, object or array
    if (!Array.isArray(result)) {
      req.erm.result = await populateCommunityDataOnUser(result);
    }
    next();
  }
  async function populateCommunityDataOnUser(user) {
    let result = user;
    let communities = (
      await CommunityMembership.find({
        "member._id": result._id,
        isBanned: false,
      })
    ).map((o) => o.community._id);
    let adminCommunities = (
      await CommunityMembership.find({
        "member._id": result._id,
        isAdmin: true,
        isBanned: false,
      })
    ).map((o) => o.community._id.toString());
    let communityFull = await Community.find({ _id: { $in: communities } });
    result.joinedCommunities = communityFull;
    result.adminCommunities = communityFull.filter((c) =>
      adminCommunities.includes(c._id.toString())
    );
    // result.adminCommunities = adminCommunities;
    return result;
  }
  // TODO: use common pattern for base uri
  router.get(`${userUri}/search`, authenticateFromHeader, async (req, res) => {
    if (!req.query.text) return res.boom.badRequest("text required to search");

    let page = parseInt(String(req.query.page)) || 1;
    let limit = parseInt(String(req.query.limit)) || 10;

    let aggregateQuery = [
      {
        $match: {
          displayname: { $regex: `${req.query.text}`, $options: "ig" },
        },
      },
      { $sort: { created_at: 1 } },
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
    let users = await User.aggregate(aggregateQuery);
    return res.json(users[0]);
  });

  restify.serve(router, User, {
    name: "user",
    findOneAndUpdate: false,
    preMiddleware: authenticateFromHeader,
    postUpdate: postUserUpdateTriggerUpdates,
    preUpdate: preUpdateAuthorizeUserUpdate,
    postRead: postReadPopulateCommunityData,
    private: [
      "email",
      "pushMessageToken",
      "blockedUsers",
      "name",
      "picture",
      "loggedout_at",
    ],
  });
}
