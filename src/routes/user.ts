import * as admin from "firebase-admin";
import { User } from "../models";
import {validateToken}  from '../modules/firebase'
import {extractTokenFromAuthHeader}  from '../helpers/roueUtils'
import { Router } from "express";
import { registerExtraRoutes } from "../helpers/roueUtils";
import restify from "express-restify-mongoose";


interface RouteObject {
  path: string;
  method: string;
  handler(req: Request, res: Response): any;
}

async function signUp(req, res) {
  let token = extractTokenFromAuthHeader(req);
 
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
      user = users[0]; 
      console.log('user in signup exist', user);
    } else {
      const username = req.body.username;
      user = new User({ name, email, picture, created_at: Date.now(), username });
      console.log('user in signup not exist ', user);
    }
    try {
      await user.save();
      //res.json(user);
    } catch (e) {
      console.log(e);
      return res.boom(e);
    }
    res.json(user);
  } else {
    res.boom.unauthorized("could not register user");
  }
}


export const userRoutes: [RouteObject] = [
  {
    path: "signup",
    method: "POST",
    handler: signUp,
  },
];

export function registerRoutes(router: Router) {
  const userUri = "/api/v1/user"; // building api url before restify to give higher priority
  // TODO: remove unnecessary function
  registerExtraRoutes(router, userUri, userRoutes);
  restify.serve(router, User, { name: "user" });
}