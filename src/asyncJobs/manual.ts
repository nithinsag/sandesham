import { connectToMongo, closeConnection } from "../models";
import { populateCommunityRank } from "./PushScheduler";

(async () => {
  await connectToMongo();
  await populateCommunityRank();
  await closeConnection();
})();
