import { extractTokenFromAuthHeader } from "../helpers/roueUtils";
import { User } from "../models";
import { validateToken } from "../modules/firebase";
import { isNull } from "util";
import { auth } from "firebase-admin";

export function authenticateFromHeader(req, res, next) {
  // wrapping execution in authMiddleware async function because
  // making middleware async will cause next to be called by express and proper error handling
  // middleware has to be set up and cannot return responses from here.
  // This middleware only does authentication, authorization has to be handled in buisness logic or an
  // authorization middleware.
  async function authMiddleware(req, res, next) {
    let token = extractTokenFromAuthHeader(req);

    if (isNull(token)) {
      return res.boom.unauthorized("invalid token");
    }
    var decodedToken;

    if (process.env.DEPLOY_ENV == "production") {
      decodedToken = await validateToken(token);
    } else {
      decodedToken = {
        name: "Test User",
        picture: "http://example.com/picure.jpg",
        email: "user@example.com",
        email_verified: true,
      };
    }

    if (typeof decodedToken == "object") {
      const { name, picture, email, email_verified } = decodedToken;
      let users, user;
      users = await User.find({ email: email });
      if (users.length > 0) {
        req.user = users[0];
      }
      if (process.env.DEPLOY_ENV !== "production") {
        req.user = {
          _id: "5f6b8b31129348b5dcd5386b",
          role: "user",
          name: "Test User",
          email: "user@example.com",
          picture: "http://example.com/picure.jpg",
          created_at: "2020-09-23T17:51:45.117Z",
          updated_at: "2020-09-23T17:51:45.122Z",
          __v: 0,
        };
      }
    }

    console.log("setting test req.user")
    return next();
  }
  authMiddleware(req, res, next);
}
