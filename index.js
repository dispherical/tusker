require('dotenv').config()
const WebSocket = require('ws');
const ws = new WebSocket(`wss://${process.env.MASTODON_HOSTNAME}/api/v1/streaming/?stream=public:remote:media&access_token=${process.env.MASTODON_API_KEY}`);
const sharp = require('sharp');

const tf = require("@tensorflow/tfjs-node")
tf.enableProdMode()
const nsfwjs = require("nsfwjs")
console.log(process.env.MASTODON_API_KEY)
async function main() {
    let model = await nsfwjs.load()

    ws.on('message', async function incoming(data) {
        try {
            var json = JSON.parse(data);
            json.payload = JSON.parse(json.payload)
            console.log(json.payload)
            try {
                json.payload.media_attachments.filter(img => img.type == "image").forEach(async attachment => {
                    console.log("ooh new attachment")
                    const file = Buffer.from(
                        await (await fetch(attachment.url)).arrayBuffer()
                    )
                    const image = sharp(file);
                    const metadata = await image.metadata();
                    const { width, height, format } = metadata;

                    if (!['jpeg', 'png', 'gif', 'bmp'].includes(format)) return
                    const decodedImage = tf.node.decodeImage(file);
                    const resizedImage = tf.image.resizeBilinear(decodedImage, [width, height]);
                    const predictions = await model.classify(resizedImage);
                    if (!predictions) return
                    const p = [
                        predictions.find(p => p.className == "Drawing").probability,
                        predictions.find(p => p.className == "Porn").probability,
                        predictions.find(p => p.className == "Hentai").probability,
                        predictions.find(p => p.className == "Sexy").probability
                    ]
                    if (Math.max(...p) < parseInt(process.env.MASTODON_PROBABILITY)) return

                    if (process.env.MASTODON_TRIGGER_ACTION == "report") {
                        const report = await (await fetch(`https://${process.env.MASTODON_HOSTNAME}api/v1/reports`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${process.env.MASTODON_API_KEY}`
                            },
                            body: JSON.stringify({
                                account_id: json.payload.account.id,
                                status_ids: json.payload.id,
                                comment: `Image flagged as NSFW with probability ${(Math.max(...p) * 100)}`,
                                forward: false
                            }),
                            redirect: "follow"
                        })).json()
                    }


                    delete file;
                    delete image;
                })
            } catch (e) { }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });
    ws.on('error', function error(err) {
        console.error('WebSocket error:', err);
    });

    ws.on('close', function close() {
        console.log('WebSocket connection closed');
    });
}
main()