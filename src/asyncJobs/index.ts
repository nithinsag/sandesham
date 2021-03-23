import { Queue } from "bullmq";
import { PushMessageJob } from "./worker";
export const messageQue = new Queue("messageSender");

export async function addJobs(data: PushMessageJob) {
  await messageQue.add("pushMessage", data);
  console.log("pushing message to que", data);
}
