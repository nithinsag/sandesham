import { Router } from "express";
interface RouteObject {
  path: string;
  method: string;
  handler(req: Request, res: Response): any;
  middlewares: any[];
}

export function extractTokenFromAuthHeader(req) {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "Bearer"
  ) {
    return req.headers.authorization.split(" ")[1];
  } else if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}
