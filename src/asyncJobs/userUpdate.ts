import dotenv from "dotenv";
dotenv.config();
import { Worker, Job } from "bullmq";
import { send } from "process";
import {
  User,
  connectToMongo,
  Post,
  Comment,
  CommunityMembership,
} from "../models";

export interface userUpdate {
  updatedUser: string;
}

(async function () {
  connectToMongo();
  const worker = new Worker(
    `${process.env.DD_ENV}userUpdate`,
    async (job: Job<userUpdate>) => {
      // Will print { foo: 'bar'} for the first job
      // and { qux: 'baz' } for the second.
      let updatedUser = await User.findOne({ _id: job.data.updatedUser });
      //let fromUser = await User.findOne({ _id: job.from });
      //
      if (updatedUser) {
        await Post.updateMany(
          { "author._id": updatedUser._id },
          {
            author: {
              _id: updatedUser?._id,
              displayname: updatedUser?.displayname,
            },
          }
        );
        await Comment.updateMany(
          { "author._id": updatedUser._id },
          {
            author: {
              _id: updatedUser?._id,
              displayname: updatedUser?.displayname,
            },
          }
        );
        await CommunityMembership.updateMany(
          { "member._id": updatedUser._id },
          {
            member: {
              _id: updatedUser?._id,
              displayname: updatedUser?.displayname,
            },
          }
        );
        // Get the Messaging service for the default app
        //
      }
    }
  );
})();
