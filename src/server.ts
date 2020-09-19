import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import mongoose from "mongoose";
import restify from "express-restify-mongoose";

import { User, Community, Post } from "./models";

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
    restify.serve(router, User);
    restify.serve(router, Community);
    restify.serve(router, Post);

    this.app.use(router);
  }

  public async config() {
    this.app.use(bodyParser.json());
    this.app.use(methodOverride());

    await mongoose.connect(process.env.MONGO_URI!, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
  }
}
