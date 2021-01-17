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

    if (token === null) {
      return next();
    }
    var decodedToken;
    try {
      if (process.env.DEPLOY_ENV == "TEST" && token) {
        decodedToken = {
          name: "Test User",
          picture: "http://example.com/picure.jpg",
          email: token,
          email_verified: true,
        };
      } else {
        decodedToken = await validateToken(token);
        console.log("token validated", decodedToken);
      }
    } catch (e) {
      console.log("Could not authenticate");
      return next();
    }

    if (
      typeof decodedToken == "object" &&
      decodedToken.provider_id != "anonymous"
    ) {
      const { name, picture, email, email_verified } = decodedToken;
      let users, user;

      users = await User.find({ email: email });
      console.log(decodedToken);

      if (users.length > 0) {
        req.user = users[0];
      } else {
        console.log("user not found, treatnig as anonymous. Signup first to fix");
      }
    } else if (decodedToken.provider_id == "anonymous") {
      req.is_anonymous = true;
      console.log("Anonymous User");
    }
    console.log("Authenticated user - ", req.user);
    console.log(decodedToken);

    return next();
  }
  authMiddleware(req, res, next);
}
