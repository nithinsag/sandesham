import { Notification, User } from "../models";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";

export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/notification/";

  router.get(`${API_BASE_URL}`, authenticateFromHeader, async (req, res) => {
    if (!req.user)
      return res.boom.unauthorized(
        "User needs to be authenticated to get messages"
      );
    let all = false;
    logger.info(req.query);
    if (req.query.all) {
      all = true;
    }
    let notification;
    if (all) {
      notification = await Notification.find({ to: req.user._id });
    } else {
      console.log("finding notification");
      notification = await Notification.find({
        to: req.user._id,
      });
    }
    return res.json(notification);
  });

  router.post(
    `${API_BASE_URL}:id/markRead`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.unauthorized(
          "User needs to be authenticated to get messages"
        );
      let notification: any = await Notification.findOne({
        _id: req.params.id,
        to: req.user._id,
      });
      if (!notification) return res.boom.badRequest("Invalid notification");
      notification.read = true;
      return res.json(await notification.save());
    }
  );
  router.post(
    `${API_BASE_URL}markAllRead`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.unauthorized(
          "User needs to be authenticated to get messages"
        );
      let result: any = await Notification.updateMany(
        {
          to: req.user._id,
          read: false,
        },
        { read: true }
      );
      return res.json(result);
    }
  );
}
