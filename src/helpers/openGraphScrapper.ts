import ogs from 'open-graph-scraper'

export async function getOGData(post) {
  const options = { url: post.link };
  let { error, result, response } = await ogs(options)
  return result
}
