import dotenv from "dotenv";
dotenv.config();
import { Worker, Job } from "bullmq";
import { send } from "process";
import { User, connectToMongo } from "../models";
import { firebaseSendNotification } from "../modules/firebase";
import { logger } from "../helpers/logger";

export interface PushMessageJob {
  to: string;
  title: string;
  message: string;
  from?: string;
  data: any;
}

(async function () {
  connectToMongo();
  const worker = new Worker(
    `${process.env.DD_ENV}messageSender`,
    async (job: Job<PushMessageJob>) => {
      // Will print { foo: 'bar'} for the first job
      // and { qux: 'baz' } for the second.
      let toUser = await User.findOne({ _id: job.data.to });
      //let fromUser = await User.findOne({ _id: job.from });
      //
      console.log("processing job", job.name, job.data);
      if (toUser?.pushMessageToken) {
        await firebaseSendNotification(
          toUser,
          job.data.title,
          job.data.message,
          job.data.data
        );
      } else {
        logger.info(
          `skipping notificatino as no push token available for ${toUser?.name}: ${toUser?._id}`
        );
      }
      // Get the Messaging service for the default app
    }
  );
})();
