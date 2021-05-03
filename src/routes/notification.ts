import { Notification, User } from "../models";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";
import Joi from "joi";

export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/notification/";

  router.get(`${API_BASE_URL}`, authenticateFromHeader, async (req, res) => {
    if (!req.user)
      return res.boom.unauthorized(
        "User needs to be authenticated to get messages"
      );
    const schema = Joi.object({
      limit: Joi.number().default(10),
      page: Joi.number().default(1),
      all: Joi.bool().default(false),
    });
    // https://mongodb-documentation.readthedocs.io/en/latest/use-cases/storing-comments.html#gsc.tab=0
    // http://www.sitepoint.com/hierarchical-data-database/
    // schema options
    const options = {
      abortEarly: false, // include all errors
      allowUnknown: true, // ignore unknown props
      stripUnknown: true, // remove unknown props
    };

    // validate request body against schema
    // validate request body against schema

    let { error, value } = schema.validate(
      { ...req.query, ...req.params },
      options
    );
    if (error) {
      return res.boom.badRequest(error);
    }
    let { limit, all, page } = value;
    logger.info(req.query);
    if (req.query.all) {
      all = true;
    }
    let notification;
    let query: any = { to: req.user._id };

    if (!all) {
      query = {
        ...query,
        read: false,
      };
    }
    notification = await Notification.find(query)
      .limit(limit)
      .skip((page - 1) * limit);
    return res.json(notification);
  });
  
  router.get(
    `${API_BASE_URL}unReadCount`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.user)
        return res.boom.unauthorized(
          "User needs to be authenticated to get messages"
        );
      let count: any = await Notification.countDocuments({
        read: false,
        to: req.user._id,
      });
      return res.json({count:count});
    }
  );

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
