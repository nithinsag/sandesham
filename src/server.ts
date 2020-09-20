import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import mongoose from "mongoose";
import restify from "express-restify-mongoose";
import boom from "express-boom";
import { userRoutes } from "./routes/user";
import { registerExtraRoutes } from "./helpers/roueUtils";

import { User, Community, Post, Comment } from "./models";

export class Server {
  public app: any;
  public router: any;

  // TODO
  private opts = {
    schema: {},
  };

  constructor(private port: number) {
    this.app = express();
  }

  async start() {
    await this.config();
    await this.api();
    try {
      await this.app.listen(this.port);
      // this.app._router.stack.forEach(function (middleware) {
      //   if (middleware.route) {
      //     // routes registered directly on the app
      //     console.log(middleware.route);
      //   } else if (middleware.name === "router") {
      //     // router middleware
      //     middleware.handle.stack.forEach(function (handler) {
      //       console.log(handler.route);
      //     });
      //   }
      // });
      console.log(`server listening on ${this.port}`);
    } catch (e) {
      console.log(e);
    }
  }

  public api() {
    this.app.get("/", function (req: any, res: any) {
      res.send("API is working!");
    });
    let router = express.Router();

    const userUri = "/api/v1/user"; // building api url before restify to give higher priority
    registerExtraRoutes(router, userUri, userRoutes);
    restify.serve(router, User, { name: "user" });


    const communityUri = restify.serve(router, Community, {
      name: "community",
    });
    const postUri = restify.serve(router, Post, { name: "post" });
    const commentUri = restify.serve(router, Comment, { name: "comment" });

    this.app.use(router);
  }

  public async config() {
    this.app.use(bodyParser.json());
    this.app.use(methodOverride());
    this.app.use(boom());

    await mongoose.connect(process.env.MONGO_URI!, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
  }
}
