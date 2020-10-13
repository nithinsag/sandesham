export function addCreatedBy(req, res, next) {
  if (req.user) {
    req.body.created_by = req.user._id;
    //console.log(req.user);
  }
  next();
}
