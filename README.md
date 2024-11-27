# Tusker

A simple server designed to flag remote NSFW posts. On social.dino.icu, we added quite a few relays and some unsavory. It's very simple.

## Setup
1. Create an API key. You can make it in the admin panel or authorize it using `node authorize.js`. It will take you through the Oauth2 flow.
2. Set the following .env variables in a file or in the shell:
```bash
MASTODON_HOSTNAME=mastodonserver.com
MASTODON_TRIGGER_ACTION=report
# NSFW scoring probability. Between 0.0 and 1 (`percent / 100`)
MASTODON_PROBABILITY=0.80
MASTODON_API_KEY=XXXXXXXXXXXXXXXXXXXXXX
```
3. Run index.js

Now it will report NSFW posts.