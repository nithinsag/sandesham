import * as admin from "firebase-admin";
import { User } from "../models";

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
  const decodedToken = await validateToken(token);
  if (typeof decodedToken == "object") {
    const { name, picture, email, email_verified } = decodedToken;
    let user = new User({ name, email, picture, created_at: Date.now() });
    try {
      await user.save();
      res.json(user);
    } catch (e) {
      console.log(e)
      res.boom(e);
    }
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
