import axios from 'axios'


export async function generateShortLink(config) {
    try {
    let response = await axios.post(`https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${process.env.FIREBASE_API_KEY}`, config)
    return response.data
    }catch(e){
        console.log(e.response)
    }

}