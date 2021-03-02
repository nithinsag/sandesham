import * as admin from "firebase-admin";

interface DecodedToken extends admin.auth.DecodedIdToken {
  name?: string;
}
interface RouteObject {
  path: string;
  method: string;
  handler(req: Request, res: Response): any;
}
declare global {
  namespace Express {
    interface Request {
      user: any;
      is_anonymous: boolean
    }

    interface Response {
      boom: any;
    }
  }
}
