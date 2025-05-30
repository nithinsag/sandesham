import { Message, User } from '../models'
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from '../helpers/logger'

export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/message/"

  router.post(`${API_BASE_URL}post`, authenticateFromHeader, async (req, res) => {
    try {
      if (!req.user) return res.boom.unauthorized('User needs to be authenticated to get messages')
      let recipient_id = req.body.recipient;
      let recipient: any = await User.findOne({ _id: recipient_id })
      if (recipient) {
        let message = await Message.create({
          text: req.body.text,
          from: {
            _id: req.user._id,
            displayname: req.user.displayname
          },
          to: {
            _id: recipient._id,
            displayname: recipient.displayname
          }
        })

        return res.json(message)
      }
      else {
        return res.boom.badRequest('Invalid recipient');
      }
    } catch (e) {
      return res.boom.badRequest(e);
    }
  })
  router.get(`${API_BASE_URL}get`, authenticateFromHeader, async (req, res) => {
    if (!req.user) return res.boom.unauthorized('User needs to be authenticated to get messages')
    let onlyUnread = false;
    logger.info(req.query)
    if (req.query.unread) {
      onlyUnread = true
    }
    let messages;
    if (onlyUnread) {
      messages = await Message.find(
        { 'to._id': req.user._id, read: false },
      )
    } else {
      messages = await Message.find({
        $or: [
          { 'from._id': req.user._id },
          { 'to._id': req.user._id },
        ]
      })
    }
    return res.json(messages)
  })

  router.post(`${API_BASE_URL}:id/markRead`, authenticateFromHeader, async (req, res) => {
    if (!req.user) return res.boom.unauthorized('User needs to be authenticated to get messages')
    let message: any = await Message.findOne({ _id: req.params.id, 'to._id': req.user._id })
    if (!message) return res.boom.badRequest('Invalid message');
    message.read = true;
    return res.json(await message.save());
  })
}
