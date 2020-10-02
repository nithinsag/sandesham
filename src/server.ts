import express from "express";
import bodyParser from "body-parser";
import methodOverride from "method-override";
import mongoose from "mongoose";
import restify from "express-restify-mongoose";
import boom from "express-boom";
import { userRoutes } from "./routes/user";
import { registerExtraRoutes } from "./helpers/roueUtils";
import { passportMiddleware } from "./middlewares/authenticate";
import { User, Community, Post, Comment } from "./models";
import morgan from "morgan";
import { addCreatedBy } from "./middlewares/mongoose/author";

import multer from 'multer';

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
    this.app.get(
      "/",
      passportMiddleware.authenticate("jwt", { session: false }),
      function (req: any, res: any) {
        res.send("API is working!");
      }
    );
    let router = express.Router();

    var upload = multer({ dest: 'uploads/' })

    router.post('/profile', upload.single('avatar'), function (req, res, next) {
      res.send("in profile");
      // req.file is the `avatar` file
      // req.body will hold the text fields, if there were any
    })

    const userUri = "/api/v1/user"; // building api url before restify to give higher priority
    registerExtraRoutes(router, userUri, userRoutes);
    restify.serve(router, User, { name: "user" });

    const communityUri = restify.serve(router, Community, {
      name: "community",
      preMiddleware: passportMiddleware.authenticate("jwt", { session: false }),
      preCreate: addCreatedBy,
    });
    const postUri = restify.serve(router, Post, {
      name: "post",
     // preMiddleware: passportMiddleware.authenticate("jwt", { session: false }),
      preCreate: addCreatedBy,
    });
    const commentUri = restify.serve(router, Comment, {
      name: "comment",
      preMiddleware: passportMiddleware.authenticate("jwt", { session: false }),
    });

    this.app.use(router);
  }

  public async config() {
    this.app.use(bodyParser.json());
    this.app.use(methodOverride());
    this.app.use(boom()); // for error handling
    this.app.use(morgan("combined")); // for logs

    // this middleware will add req.user to routes requiring authentication
    this.app.use(passportMiddleware.initialize());
    // passport.authenticate('jwt', { session: false }) can be used to protect private routes
    await mongoose.connect(process.env.MONGO_URI!, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
  }
}
