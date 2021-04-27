import { getOGData } from "../helpers/openGraphScraper";
import createAvatar from "../helpers/avatars";
import { authenticateFromHeader } from "../middlewares/authenticate";
export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/utility/";
  router.post(
    `${API_BASE_URL}ogPreview`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.body.url) return res.boom.badRequest("valid url required");
      try {
        let result = await getOGData(req.body.url);
        return res.json(result);
      } catch (e) {
        console.log(e);

        return res.boom.badRequest("could not get og data");
      }
    }
  );

  router.get(
    `${API_BASE_URL}avatar/:name`,
    authenticateFromHeader,
    async (req, res) => {
      if (!req.params.name)
        return req.boom.badRequest("specify name to generate avatar");
      let img = await createAvatar(req.params.name);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": `max-age=${60 * 60 * 24 * 365}`,
        "Content-Length": img.length,
      });
      res.end(img);
    }
  );
}
