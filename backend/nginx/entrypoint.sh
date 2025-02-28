#!/bin/bash

if [ ! -f "/etc/letsencrypt/live/javabudd.hopto.org/fullchain.pem" ]; then
    certbot certonly --standalone \
        --agree-tos \
        --email javabudd@gmail.com \
        --non-interactive \
        --preferred-challenges http \
        -d javabudd.hopto.org
else
    echo "Certificate already exists. Skipping certbot request."
fi

exec "$@"