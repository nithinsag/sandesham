import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import mongoose from "mongoose";
import boom from "express-boom";
import morgan from "morgan";
import { registerRoutes } from "./routes";
import { messageQue } from "./asyncJobs";
import { router as bullBoard } from "bull-board";
import { connectToMongo } from "./models";
import "./tracer";
const { setQueues, BullMQAdapter } = require("bull-board");

export class Server {
  public app: any;
  private server: any;
  public db: any;
  public router: any;
  public cloudinary: any;

  private opts = {
    schema: {},
  };

  constructor(private port: number) {
    this.app = express();
    this.port = port;
  }

  async start() {
    try {
      await this.config();
      await this.api();
      let connection = await connectToMongo();

      this.server = await this.app.listen(this.port);
      this.db = connection.connection.db;
    } catch (e) {
      console.log(e);
    }
  }

  public api() {
    this.app.get("/", function (req: any, res: any) {
      res.send("API is working!");
    });
    let router = express.Router();
    registerRoutes(router);
    this.app.use(router);
  }

  public stop() {
    this.server.close();
    messageQue.close();
    mongoose.connection.close();
  }
  public async config() {
    this.app.use(bodyParser.json());
    this.app.use(methodOverride());
    this.app.use(boom()); // for error handling
    this.app.use(morgan("combined")); // for logs
    if (process.env.DEPLOY_ENV !== "TEST") {
      setQueues([new BullMQAdapter(messageQue)]);
    }
    this.app.use("/admin/que", bullBoard);

    // passport.authenticate('jwt', { session: false }) can be used to protect private routes
  }
}
