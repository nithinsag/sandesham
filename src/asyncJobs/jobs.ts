import cron from "node-cron";
import {
  notifyTopContributor,
  PromoteTopPost,
  populateCommunityRank,
} from "./PushScheduler";
import { connectToMongo } from "../models";
const job1 = cron.schedule("0 20 * * *", getSchedulerFunction(4), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
const job2 = cron.schedule("0 14 * * *", getSchedulerFunction(8), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
const job3 = cron.schedule("0 16 * * *", getSchedulerContributor(12), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});
const job4 = cron.schedule("0 20 * * *", getSchedulerContributor(4), {
  scheduled: false,
  timezone: "Asia/Kolkata",
});

function getSchedulerFunction(period) {
  return function () {
    PromoteTopPost(period);
  };
}

function getSchedulerContributor(period) {
  return function () {
    notifyTopContributor(period);
  };
}
(async () => {
  await connectToMongo();
  job1.start();
  job2.start();
  job3.start();
  job4.start();
})();
