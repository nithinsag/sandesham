import { Router } from "express";
import { addCreatedBy } from "../middlewares/mongoose/author";

import { authenticateFromHeader } from "../middlewares/authenticate";
import { Post, Comment } from "../models";
import restify from "express-restify-mongoose";



export function registerRoutes(router: Router) {
  const postUri = restify.serve(router, Post, {
    name: "post",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });

  router.post(`${postUri}/:id/upvote`, authenticateFromHeader, (req, res) => {
    if (req.user) {
      res.json({ status: "upvoted" });
    } else {
      //    res.boom.unauthorized("User needs to be authenticated to vote!");
    }
  });

  const commentUri = restify.serve(router, Comment, {
    name: "comment",
    preMiddleware: authenticateFromHeader,
    preCreate: addCreatedBy,
  });
}
