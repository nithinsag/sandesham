import * as admin from "firebase-admin";

let serviceAccount = require("../../config/google-services.json");

interface DecodedToken extends admin.auth.DecodedIdToken {
    name?: string;
  }
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