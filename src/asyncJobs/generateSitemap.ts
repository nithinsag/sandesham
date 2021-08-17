import { connectToMongo, closeConnection, Post, Community, User } from "../models";
import { createDynamicLinkFromPost } from "../helpers/shortlink";
import dotenv from 'dotenv'
import { simpleSitemapAndIndex } from 'sitemap'



(async () => {
  dotenv.config()
  await connectToMongo();
  let posts = await Post.find({ isDeleted: false })
  let communities = await Community.find()
  let users = await User.find()
  let siteUrls: any = []

  siteUrls.push({ url: '/', changeFrequency: 'hourly' })
  siteUrls.push({ url: '/popular', changeFrequency: 'hourly' })
  siteUrls.push(...communities.map(p => ({ url: `/community/${p._id}`, changeFrequency: 'hourly' })))
  siteUrls.push(...posts.map(p => ({ url: `/post/${p._id}`, changeFrequency: 'hourly' })))
  siteUrls.push(...users.map(p => ({ url: `/user/${p._id}`, changeFrequency: 'hourly' })))

  try {
    console.log(`generating sitemap for ${siteUrls.length}`)
    let sitemap = await simpleSitemapAndIndex({
      hostname: 'https://ulkka.in', destinationDir: './sitemap',
      sourceData: siteUrls
    })
    console.log(sitemap)
  }
  catch (e) {
    console.log(e)
  }

  console.log("completed running job")
  await closeConnection();
})();
