import { Post, User } from "../models";
import { authenticateFromHeader } from "../middlewares/authenticate";
import { logger } from "../helpers/logger";

export function registerRoutes(router) {
  router.get(`/api/v1/tags`, authenticateFromHeader, async (req, res) => {
    logger.info(`inside popular feed route`);

    let aggregateQuery = [
      {
        $addFields: {
          score: {
            // https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9
            $sum: [
              { $log: [{ $max: [{ $abs: "$voteCount" }, 1] }, 10] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $sum: [{ $toLong: "$created_at" }, -1613054140757] }, // to make log votes and time factor in the same
                      45000000,
                    ],
                  },
                  {
                    $divide: [
                      "$voteCount",
                      { $max: [{ $abs: "$voteCount" }, 1] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { $project: { tags: 1, score: 1 } },
      {
        $unwind: "$tags",
      },

      { $group: { _id: "$tags", score: { $sum: "$score" } } },
      {
        $sort: {
          score: -1,
        },
      },
      {
        $limit: 10,
      },
    ];

    let posts = await Post.aggregate(aggregateQuery);
    res.json(posts);
  });
}
