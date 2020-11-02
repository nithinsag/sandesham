import ogs from 'open-graph-scraper'

export async function getOGData(link) {
  const options = { url: link };
  let { error, result, response } = await ogs(options)
  return result
}
