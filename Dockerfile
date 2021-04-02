# docker build --rm -f "Dockerfile" -t paulgilchrist/mongodb-insert:latest .
# docker push paulgilchrist/mongodb-insert
FROM node:alpine
LABEL author="Paul Gilchrist"
RUN mkdir /src
RUN mkdir /src/mongodb-insert
COPY ./package.json /src/mongodb-insert/
COPY ./insertMongo.js /src/mongodb-insert/
WORKDIR /src/mongodb-insert
RUN npm i
ENTRYPOINT ["node", "insertMongo.js", "-n", "200"]
# Optional troubleshooting commands
# docker run -d paulgilchrist/mongodb-insert
# docker rm -f <containerID>
# ENTRYPOINT ["sleep", "infinity"] # This can keep the container running, so you can connect and troubleshoot

