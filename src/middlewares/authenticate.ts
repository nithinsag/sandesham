import { extractTokenFromAuthHeader } from "../helpers/roueUtils";
import { User } from "../models";
import { validateToken } from "../modules/firebase";
import { isNull } from "util";
import { auth } from "firebase-admin";
import { logger } from "../helpers/logger";

export function authenticateFromHeader(req, res, next) {
  // wrapping execution in authMiddleware async function because
  // making middleware async will cause next to be called by express and proper error handling
  // middleware has to be set up and cannot return responses from here.
  // This middleware only does authentication, authorization has to be handled in buisness logic or an
  // authorization middleware.
  async function authMiddleware(req, res, next) {
    let token = extractTokenFromAuthHeader(req);
    logger.info("token: " + token);
    logger.info("deploy env: " + process.env.DEPLOY_ENV);
    if (token === null) {
      req.is_anonymous = true;
      return next();
    }
    var decodedToken;
    try {
      /**
       * For testing api using postman set DEPLOY_ENV environment variable as test and set the email as the bearer token.
       * This will decode the user to the email
       */

      if (process.env.DEPLOY_ENV == "TEST" && token) {
        logger.info("using test token decoding");
        decodedToken = {
          name: "Test User",
          picture: "http://example.com/picure.jpg",
          email: token,
          email_verified: true,
        };
      } else {
        decodedToken = await validateToken(token);
        logger.info("token validated" + JSON.stringify(decodedToken));
      }
    } catch (e) {
      logger.info("Could not authenticate");
      return res.boom.unauthorized("token expired");
    }

    if (
      typeof decodedToken == "object" &&
      decodedToken.provider_id != "anonymous"
    ) {
      const { name, picture, email, email_verified } = decodedToken;
      let users, user;

      users = await User.find({ email: email });
      logger.info(users);
      logger.info(decodedToken);

      if (users.length > 0) {
        req.user = users[0];
      } else {
        logger.info(
          "user not found, treating as anonymous. Signup first to fix"
        );
        req.is_anonymous = true;
      }
    } else {
      // treat as anonymous
      // } else if (decodedToken.provider_id == "anonymous") {
      req.is_anonymous = true;
      logger.info("Anonymous User");
    }
    logger.info("Authenticated user - " + JSON.stringify(req.user));
    logger.info(decodedToken);

    return next();
  }
  authMiddleware(req, res, next);
}
