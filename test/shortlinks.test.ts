import { generateShortLink } from '../src/modules/firebaseDynamicLinks'
import dotenv from 'dotenv'
dotenv.config()
describe("Should generate shortlink from link", () => {

    test("it should generate short link from long link", async () => {

        const config = {
            dynamicLinkInfo: {
                link: "https://ulkka.in/post/234",
                androidInfo: {
                    androidPackageName: "in.ulkka",
                },
                iosInfo: {
                    iosBundleId: "in.ulkka",
                    iosAppStoreId: "1563474580",
                },
                // domainUriPrefix is created in your Firebase console
                domainUriPrefix: "https://link.ulkka.in",
                // optional setup which updates Firebase analytics campaign
                socialMetaTagInfo: {
                    socialTitle: 'share link',
                    socialDescription: "share description ",
                    socialImageLink: 'https://media.ulkka.in/image/upload/q_80/v1628267526/image/2021-08-06T16:32:04.960Z.jpg',
                },
            }
        }
        let shortlinkData = await generateShortLink(config)
        console.log(shortlinkData)
        expect(shortlinkData.shortLink.length).toBeGreaterThanOrEqual(1)
    });
});
