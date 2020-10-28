import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticateFromHeader } from "../middlewares/authenticate";

export  function registerRoutes(router: Router) {

  var upload = multer({
    dest: "uploads/",
    limits: { fieldSize: 25 * 1024 * 1024 }
  });

    router.post(
      "/api/v1/media/:type/upload",
      authenticateFromHeader,
      upload.single("file"),
      function (req, res) {
        var reqClone: any = req;
  
        const path = reqClone.file.path;
        const uniqueFilename = new Date().toISOString();
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        cloudinary.uploader.upload(
          path,
          {
            public_id: `${req.params.type}/${uniqueFilename}`,
            tags: `${req.params.type}`,
          }, // directory and tags are optional
          function (err, image) {
            if (err) return res.send(err);
            console.log("file uploaded to Cloudinary");
            // remove file from server
            // const fs = require('fs')
            // fs.unlinkSync(path)
            // return image details
            res.json(image);
          }
        );
  
        // req.file is the `avatar` file
        // req.body will hold the text fields, if there were any
      }
    );

}