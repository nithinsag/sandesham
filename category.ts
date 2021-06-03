import dotenv from "dotenv";

dotenv.config();
import { CommunityCategory, connectToMongo } from "./src/models";

(async function () {
  await connectToMongo();
  let cat = new CommunityCategory({ name: "sports" });
  cat.save();
})();
