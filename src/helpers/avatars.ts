import botttsStyles from "@dicebear/avatars-bottts-sprites";

import Avatars, { SpriteCollection, Options } from "@dicebear/avatars";
import sharp from "sharp";

export default async function createAvatar(seed) {
  let options = {};
  options["h"] = options["w"] = 256;

  let avatars = new Avatars(botttsStyles);
  let svg = avatars.create(seed, options);

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return png;
}
