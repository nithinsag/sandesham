import * as admin from "firebase-admin";
import { User } from "../models";
import {validateToken}  from '../modules/firebase'
import {extractTokenFromAuthHeader}  from '../helpers/roueUtils'


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
    const displayname = req.body.displayname;
    let users, user;
    users = await User.find({ email: email });
    if (users.length > 0) {
      user = users[0];
    } else {
      user = new User({ name, email, picture, created_at: Date.now(), displayname });
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
