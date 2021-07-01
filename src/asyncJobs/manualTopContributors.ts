import { connectToMongo, closeConnection } from "../models";
import { notifyTopContributor } from "./PushScheduler";

(async () => {
  await connectToMongo();
  await notifyTopContributor(8000);
  await closeConnection();
})();
