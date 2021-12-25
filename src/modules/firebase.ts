import * as admin from "firebase-admin";
import { logger } from "../helpers/logger";

let serviceAccount = require("../../config/" + process.env.GOOGLE_APPLICATION_CREDENTIALS);

interface DecodedToken extends admin.auth.DecodedIdToken {
  name?: string;
}
export const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

export async function firebaseSendNotification(
  user: any,
  title: string,
  body: string,
  data: any
) {
  const payload = {
    notification: {
      title: title,
      body: body,
    },
    data: data,
  };
  const deviceToken = user.pushMessageToken;
  if (deviceToken) {
    return admin.messaging().sendToDevice(deviceToken, payload);
  }
  logger.info(`Device token does not exist for ${user.displayname}`);
}

export async function sendMulticastNotification(
  tokens: any,
  title: string,
  body: string,
  data: any
) {
  const payload = {
    notification: {
      title: title,
      body: body,
    },
    tokens: tokens,
    data: data,
  };

  return admin.messaging().sendMulticast(payload);
}
