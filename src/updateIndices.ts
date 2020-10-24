import mongoose, { Model } from "mongoose";
import dotenv from "dotenv";
import { Comment } from "./models";

dotenv.config();

async function sync() {
  const connection = await mongoose.connect(process.env.MONGO_URI!, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    autoIndex: true,
  });

  await Comment.syncIndexes();
  await connection.disconnect();
}

sync();
