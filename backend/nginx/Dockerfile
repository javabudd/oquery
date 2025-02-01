FROM nginx:1.27.3

RUN apt update && \
    apt upgrade

RUN apt install -y certbot

COPY entrypoint.sh /

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["nginx", "-g", "daemon off;"]