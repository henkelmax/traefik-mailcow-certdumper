FROM docker:latest

LABEL maintainer="Max Henkel <mh@maxhenkel.de>"

WORKDIR /certdumper/

RUN apt-get update -y
# RUN apt-get install curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash
RUN apt-get install nodejs -y
RUN npm install yarn

COPY package.json .
COPY yarn.lock .

RUN yarn install --production --silent

COPY . .

ENTRYPOINT []

CMD ["node","index.js"]
