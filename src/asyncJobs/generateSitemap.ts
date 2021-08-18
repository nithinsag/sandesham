import { connectToMongo, closeConnection, Post, Community, User } from "../models";
import { createDynamicLinkFromPost } from "../helpers/shortlink";
import dotenv from 'dotenv'
import { simpleSitemapAndIndex } from 'sitemap'

import archiver from 'archiver'
import fs from 'fs';
import cron from "node-cron";
import axios from "axios";
const job1 = cron.schedule(
  "0 * * * *",
  cronMonitorWrapper(
    generateSitemap,
    "https://hc-ping.com/df66123d-2b1d-4c5e-a7ad-1cbabb9dc802"
  ),
  {
    timezone: "Asia/Kolkata",
  }
)
function cronMonitorWrapper(f, url) {
  return async () => {
    await f();
    await axios.get(url);
  };
}
export async function generateSitemap() {
  dotenv.config()
  await connectToMongo();
  let posts = await Post.find({ isDeleted: false })
  let communities = await Community.find()
  let users = await User.find()
  let siteUrls: any = []

  siteUrls.push({ url: '/', changeFrequency: 'hourly' })
  siteUrls.push({ url: '/popular', changeFrequency: 'hourly' })
  siteUrls.push({ url: '/terms.html', changeFrequency: 'daily' })
  siteUrls.push({ url: '/privacy-policy.html', changeFrequency: 'daily' })
  siteUrls.push(...communities.map(p => ({ url: `/community/${p._id}`, changeFrequency: 'hourly' })))
  siteUrls.push(...posts.map(p => ({ url: `/post/${p._id}`, changeFrequency: 'hourly' })))
  siteUrls.push(...users.map(p => ({ url: `/user/${p._id}`, changeFrequency: 'hourly' })))

  try {
    console.log(`generating sitemap for ${siteUrls.length}`)
    let sitemap = await simpleSitemapAndIndex({
      hostname: 'https://ulkka.in', destinationDir: './sitemap/source',
      sourceData: siteUrls,
      gzip: false,
      publicBasePath: '/sitemap'
    })

    const output = fs.createWriteStream('./sitemap/sitemap.zip');
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', function () {
      console.log(archive.pointer() + ' total bytes');
      console.log('archiver has been finalized and the output file descriptor has closed.');
    });

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', function () {
      console.log('Data has been drained');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function (err) {
      throw err;
    });

    archive.pipe(output);
    archive.directory('./sitemap/source/', false);
    archive.finalize();
    console.log(sitemap)
  }
  catch (e) {
    console.log(e)
  }

  console.log("completed running job")
  await closeConnection();
}