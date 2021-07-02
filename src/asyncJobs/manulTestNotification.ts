import { connectToMongo, closeConnection, User } from "../models";
import { notifyTopContributor } from "./PushScheduler";
import { firebaseSendNotification } from "../modules/firebase";
(async () => {
  await connectToMongo();
  let user = await User.findOne({ displayname: "manavalan" });
  firebaseSendNotification(user, "test title", "test body", {
    type: "post",
    link: `/post/608bd26402f69139f611f647`,
    notification_id: "customtst",
  });
  await closeConnection();
})();
