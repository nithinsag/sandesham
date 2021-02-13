export function addCreatedBy(req, res, next) {
  if (req.user) {
    req.body.author = { _id: req.user._id, name: req.user.name };
  } else {
    res.boom.unauthorized("Unauthenticated user");
    return
  }
  next();
}
