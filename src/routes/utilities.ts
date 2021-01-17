import { getOGData } from "../helpers/openGraphScraper";
export function registerRoutes(router) {
  let API_BASE_URL = "/api/v1/utility/";
  router.post(`${API_BASE_URL}ogPreview`, async (req, res) => {
    if (!req.body.url) return res.boom.badRequest("valid url required");
    try {
      let result = await getOGData(req.body.url);
      return res.json(result);
    } catch (e) {
      console.log(e);

      return res.boom.badRequest("could not get og data");
    }
  });
}
