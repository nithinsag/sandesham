import * as admin from "firebase-admin";
import { User } from "../models";
import { validateToken } from "../modules/firebase";
import { extractTokenFromAuthHeader } from "../helpers/roueUtils";
import { Router } from "express";
import restify from "express-restify-mongoose";
import { logger } from "../helpers/logger";
import { authenticateFromHeader } from "../middlewares/authenticate";
import Joi from "joi";

export function registerRoutes(router: Router) {
  const userUri = "/api/v1/user"; // building api url before restify to give higher priority
  // TODO: remove unnecessary function
  router.post(
    `${userUri}/registerMessageToken`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user) {
        return res.boom.unauthorized("User needs to be authenticated to vote!");
      }

      if (req.body.pushMessageToken) {
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
        logger.debug("user in signup not exist " + JSON.stringify(user));
      }
      try {
        logger.info("creating new user");
        await user.save();
        //res.json(user);
      } catch (e) {
        logger.debug("failed to create user");
        logger.debug(e);
        return res.boom(e);
      }
      res.json(user);
    } else {
      res.boom.unauthorized("could not register user");
    }
  });

  restify.serve(router, User, { name: "user" });
}
