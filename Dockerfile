FROM docker:latest

LABEL maintainer="Max Henkel <mh@maxhenkel.de>"

WORKDIR /certdumper/

RUN apk add --update nodejs yarn

COPY package.json .
COPY yarn.lock .

RUN yarn install --production --silent

COPY . .

ENV NODE_ENV production

ENTRYPOINT []

CMD ["node", "index.js"]
