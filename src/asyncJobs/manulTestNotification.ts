import { connectToMongo, closeConnection, User } from "../models";
import { notifyTopContributor } from "./PushScheduler";
import { firebaseSendNotification } from "../modules/firebase";
import dotenv from "dotenv";
dotenv.config();
(async () => {
  await connectToMongo();
  let user = await User.findOne({ displayname: "manavalan" });
  await firebaseSendNotification(user, "test title", "test body", {
    type: "post",
    link: `/post/608bd26402f69139f611f647`,
    notification_id: "customtst",
  });
  await closeConnection();
})();
