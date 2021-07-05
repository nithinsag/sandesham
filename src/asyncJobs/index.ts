import { Queue } from "bullmq";
import { PushMessageJob } from "./worker";
import { Notification } from "../models";
import { userUpdate } from "./userUpdate";
export const messageQue = new Queue(`${process.env.DD_ENV}messageSender`);
export const userUpdateQue = new Queue(`${process.env.DD_ENV}userUpdate`);

export async function createNotification(data: PushMessageJob) {
  let notification = new Notification({
    to: data.to,
    text: data.message,
    title: data.title,
    link: data?.data?.link,
    detailedLink: data?.data?.detailedLink,
  });
  notification = await notification.save();
  data.data.notification_id = notification._id;
  await messageQue.add("pushMessage", data);
}

export async function updateUser(data: userUpdate) {
  await userUpdateQue.add("userUpdate", data);
}
