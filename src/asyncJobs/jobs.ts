import cron from "node-cron";
import {
  notifyTopContributor,
  PromoteTopPost,
  populateCommunityRank,
} from "./PushScheduler";
import axios from "axios";
import { connectToMongo } from "../models";
const job1 = cron.schedule(
  "0 20 * * *",
  cronMonitorWrapper(
    getSchedulerFunction(4),
    "https://hc-ping.com/e94f24c6-0640-4b1a-8415-963ad94db983"
  ),
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);
const job2 = cron.schedule(
  "0 14 * * *",
  cronMonitorWrapper(
    getSchedulerFunction(8),
    "https://hc-ping.com/e94f24c6-0640-4b1a-8415-963ad94db983"
  ),
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);

const job3 = cron.schedule(
  "0 15 * * *",
  cronMonitorWrapper(
    getSchedulerContributor(12),
    "https://hc-ping.com/1cd75e55-8605-438e-8190-5575fbd259b8"
  ),
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);
const job4 = cron.schedule(
  "0 19 * * *",
  cronMonitorWrapper(
    getSchedulerContributor(4),
    "https://hc-ping.com/1cd75e55-8605-438e-8190-5575fbd259b8"
  ),
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);

const job5 = cron.schedule(
  "*/30 * * * *",
  cronMonitorWrapper(
    populateCommunityRank,
    "https://hc-ping.com/b64f2c36-76ae-4b2b-9296-428cb16aff1f"
  ),
  {
    scheduled: false,
    timezone: "Asia/Kolkata",
  }
);
function getSchedulerFunction(period) {
  return async function () {
    await PromoteTopPost(period);
  };
}

function getSchedulerContributor(period) {
  return async function () {
    await notifyTopContributor(period);
  };
}

function cronMonitorWrapper(f, url) {
  return async () => {
    await f();
    await axios.get(url);
  };
}
(async () => {
  await connectToMongo();
  job1.start();
  job2.start();
  job3.start();
  job4.start();
  job5.start();
})();
