
import { generateShortLink } from '../modules/firebaseDynamicLinks'
function getImageLinkFromPost(post) {
    let url = 'https://media.ulkka.in/image/upload/v1622024421/image/2021-05-26T10:20:19.136Z.png'
    if (post.type == "image") {
        url = post.mediaMetadata?.secure_url
    }
    else if (post.type == "video") {
        let mediaUrl = post.mediaMetadata?.secure_url
        url = mediaUrl.substring(0, mediaUrl.lastIndexOf(".")) + ".jpg"
    }
    else if (post.type == "gif") {
        let mediaUrl = post.mediaMetadata?.secure_url
        url = mediaUrl.split(".gif")[0] + ".png"
    }
    else if (post.type == "link") {
        url = post.ogData?.ogImage?.url
    }

    if (url.includes('https://media.ullka.in')) {
        let parts = url.split('upload/')
        url = parts.join('upload/w_300,q_80/')
    }

    return url

}

export async function createDynamicLinkFromPost(post) {

    let link = `https://ulkka.in/post/${post._id}`
        console.log("shortlingk", process.env.ENABLE_SHORTLINK)
    if (!process.env.ENABLE_SHORTLINK) {
        return link
    }

    const shareTitle = post.title.substring(0, 150)

    const socialTitle = `Posted by ${post.author.displayname} on ${post.community.name} : "${shareTitle}"`
    const socialDescription = `Ulkka - Kerala's Own Community!\n ${post.voteCount} votes, ${post.commentCount} comments - ${socialTitle}`;
    const config = {
        dynamicLinkInfo: {
            link: link,
            androidInfo: {
                androidPackageName: process.env.ANDROID_PACKAGE_NAME,
                androidFallbackLink: link

            },
            iosInfo: {
                iosBundleId: process.env.IOS_BUNDLE_ID,
                iosAppStoreId: process.env.IOS_APPSTORE_ID,
                iosFallbackLink: link
            },
            // domainUriPrefix is created in your Firebase console
            domainUriPrefix: process.env.SHORTURI_PREFIX,
            // optional setup which updates Firebase analytics campaign
            socialMetaTagInfo: {
                socialTitle: socialTitle,
                socialDescription: socialDescription,
                socialImageLink: getImageLinkFromPost(post),
            },
        },
        suffix: {
            option: "SHORT"
        }
    }
    let shortLink = (await generateShortLink(config)).shortLink
    return shortLink
}