const os = require('node:os');
const net = require("node:net");
const fs = require("node:fs")
const express = require('express')
const bodyParser = require('body-parser');
const app = express()
const port = 3000

app.use(bodyParser.json());

const mastodonInstance = "https://mastodonserver.com"
async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', (err) => {
            reject(err);
        });
    });
}
async function main() {
    const port = await getFreePort()
    const interfaces = os.networkInterfaces();
    const redirectUris = []
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const address of addresses) {
            if (address.family === 'IPv4') {
                redirectUris.push(`http://${address.address}:${port}/callback`)
            }
        }
    }

    const mastodonApp = await (await fetch(`${mastodonInstance}/api/v1/apps`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "client_name": "Tusker",
            "redirect_uris": redirectUris,
            "scopes": "write:reports read:statuses",
            "website": "https://github.com/dispherical/tusker"
        }),
        redirect: "follow"
    })).json()
    console.log(`Visit one of these pages to start the Oauth2 authorization:
${redirectUris.map(url => `- ${url.replace("callback", "")}`).join("\n")}`)
    app.get('/', (req, res) => {
        const host = `${req.protocol}://${req.get('host')}/callback`
        const authUrl = `${mastodonInstance}/oauth/authorize?response_type=code&client_id=${mastodonApp.client_id}&redirect_uri=${encodeURIComponent(host)}&scope=read write push write:reports read:statuses`;
        res.redirect(authUrl)
    })
    app.get('/callback', async (req, res) => {
        const { code } = req.query;
        const host = `${req.protocol}://${req.get('host')}/callback`

        const response = await (await fetch(`${mastodonInstance}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                client_id: mastodonApp.client_id,
                client_secret: mastodonApp.client_secret,
                redirect_uri: host,
                grant_type: 'authorization_code',
                code: code
            })
        })).json()
        const { access_token } = response
        if (!access_token) return res.send("Oops, authorization failed.").status(400);
        fs.appendFileSync(".env", `\nMASTODON_API_KEY=${access_token}`)
        res.send("Saved to .env!")

    })
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })

}
main()