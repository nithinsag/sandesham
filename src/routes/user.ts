import * as admin from "firebase-admin";
import { User } from "../models";
import jwt from "jsonwebtoken";

interface DecodedToken extends admin.auth.DecodedIdToken {
  name?: string;
}
interface RouteObject {
  path: string;
  method: string;
  handler(req: Request, res: Response): any;
}

let serviceAccount = require("../../config/google-services.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://vellarikka-pattanam.firebaseio.com",
});

export async function validateToken(
  idToken: any
): Promise<DecodedToken | boolean> {
  try {
    let decodedToken: DecodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.log(err);
    return false;
  }
  // ...
}

async function signUp(req, res) {
  const { token } = req.body;
  console.log(req.body);
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
    } else {
    user = new User({ name, email, picture, created_at: Date.now() });
    }
    try {
      await user.save();
      //res.json(user);
    } catch (e) {
      console.log(e);
      return res.boom(e);
    }

    const token = jwt.sign({ user: user }, process.env.TOKEN_SECRET);
    res.json({ token: token });
  } else {
    res.boom.unauthorized("could not register user");
  }
}

async function registerNewUser(idToken: any) {}

export const userRoutes: [RouteObject] = [
  {
    path: "signup",
    method: "POST",
    handler: signUp,
  },
];
