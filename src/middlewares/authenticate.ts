import jwt from "jsonwebtoken";
import passport from "passport";

import { Strategy as JwtStrategy } from "passport-jwt";
import { ExtractJwt } from "passport-jwt";

let opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.TOKEN_SECRET,
};

export const passportMiddleware = passport.use(
  new JwtStrategy(opts, function (jwt_payload, done) {
    if (jwt_payload.user) {
      return done(null, jwt_payload.user);
    }
    return done(null, false, "Failed to authenticate");
  })
);
