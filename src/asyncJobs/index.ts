import { Queue } from "bullmq";
import { PushMessageJob } from "./worker";
import { Notification } from "../models";
export const messageQue = new Queue(`${process.env.DD_ENV}messageSender`);

export async function addJobs(data: PushMessageJob) {
  await messageQue.add("pushMessage", data);
  let notification = new Notification({
    to: data.to,
    text: data.message,
    title: data.title,
    link: data?.data?.link,
  });
  await notification.save();
}
