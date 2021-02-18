import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import mongoose from "mongoose";
import boom from "express-boom";
import morgan from "morgan";
import { registerRoutes } from "./routes";
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
  }

  async start() {
    try {
      await this.config();
      await this.api();
      let connection = await mongoose.connect(process.env.MONGO_URI!, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        autoIndex: true,
      });

      this.server = await this.app.listen(this.port);
      this.db = connection.connection.db;
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
    registerRoutes(router);
    this.app.use(router);
  }

  public stop() {
    this.server.close();
    mongoose.connection.close();
  }
  public async config() {
    this.app.use(bodyParser.json());
    this.app.use(methodOverride());
    this.app.use(boom()); // for error handling
    this.app.use(morgan("combined")); // for logs

    // passport.authenticate('jwt', { session: false }) can be used to protect private routes
  }
}
