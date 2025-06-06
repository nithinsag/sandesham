import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticateFromHeader } from "../middlewares/authenticate";

export function registerRoutes(router: Router) {
  var upload = multer({
    dest: "uploads/",
    limits: { fieldSize: 50 * 1024 * 1024 }, // 50Mb file limit
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

      let cloudinaryOptions: any = {
        public_id: `${req.params.type}/${uniqueFilename}`,
        tags: `${req.params.type}`,
        resource_type: "auto",
      }; // directory and tags are optional

      if (req.params.type == "video")
        cloudinaryOptions = { ...cloudinaryOptions, width: 480, crop: "limit" };
      cloudinary.uploader.upload(
        path,
        cloudinaryOptions,
        function (err, image) {
          if (err) return res.send(err);
          console.log("file uploaded to Cloudinary");
          // remove file from server
          // const fs = require('fs')
          // fs.unlinkSync(path)
          // return image details
          if (image && process.env.CLOUDINARY_RESP_URL && process.env.CDN_URL) {
            image.url = image.url.replace(
              process.env.CLOUDINARY_RESP_URL,
              process.env.CDN_URL
            );
            image.secure_url = image.secure_url.replace(
              process.env.CLOUDINARY_RESP_URL,
              process.env.CDN_URL
            );
          }
          res.json(image);
        }
      );

      // req.file is the `avatar` file
      // req.body will hold the text fields, if there were any
    }
  );
}
