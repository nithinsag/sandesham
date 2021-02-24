export function addCreatedBy(req, res, next) {
  if (req.user) {
    // TODO: when user changes displayname, update all displayname fields asynchronously
    req.body.author = { _id: req.user._id, displayname: req.user.displayname };
  } else {
    res.boom.unauthorized("Unauthenticated user");
    return;
  }
  next();
}
