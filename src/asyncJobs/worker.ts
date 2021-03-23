import dotenv from "dotenv";
dotenv.config();
import { Worker, Job } from "bullmq";
import { send } from "process";
import { User, connectToMongo } from "../models";
import { sendNotification } from "../modules/firebase";

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
    "messageSender",
    async (job: Job<PushMessageJob>) => {
      // Will print { foo: 'bar'} for the first job
      // and { qux: 'baz' } for the second.
      let toUser = await User.findOne({ _id: job.data.to });
      //let fromUser = await User.findOne({ _id: job.from });
      //
      console.log("processing job", job.name, job.data);

      await sendNotification(
        toUser,
        job.data.title,
        job.data.message,
        job.data.data
      );
      // Get the Messaging service for the default app
    }
  );
})();
