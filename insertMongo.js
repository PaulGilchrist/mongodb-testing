"use strict";
/*
Setup MongoDB using either Docker Desktop (recommended), Azure Container Instance, or Kubernetes
    as documented in their respective setup folders
*/
const faker = require("faker/locale/en_US");
const args = require("minimist")(process.argv.slice(2)); // Get arguments by name rather than by index
const mongoClient = require("mongodb").MongoClient;
const v8 = require("v8");

// Configuration
const databaseType = args["d"] || process.env.databaseType || "mongoDb"; // mongoDb, cosmosDbProvisioned, or cosmosDbServerless
const numContactsToCreate = args["n"] || process.env.numContactsToCreate || 200; // Use 20 million if wanting to later do performance testing on the dataset
let batchSize = Math.min(numContactsToCreate, 2000); // Recommend 500 for remote server
let insertInterval = 150; // Recommend 150-250 for remote server

// Global variables
let client = null;
const collectionName = "contacts";
let db = null;
const dbName = "mongotest";
const mongoClientOptions = {
  connectTimeoutMS: 300000, // 5 min - May need to wait for the container to finish creation process and first time database setup
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

let connectionString = null;
switch (databaseType) {
  case "cosmosDbProvisioned":
    connectionString =
      args["c"] || process.env.cosmosDbProvisionedConnectionString;
    break;
  case "cosmosDbServerless":
    connectionString =
      args["c"] || process.env.cosmosDbServerlessConnectionString;
    break;
  default:
    connectionString =
      args["c"] ||
      process.env.mongoDbConnectionString ||
      "mongodb://localhost:27017/";
}

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null;

let currentContacts = 0;

let inErrorState = false;
let retryCount = 0;
let maxRetries = 10;
let timeInErrorState = Date.now();

const main = async () => {
  try {
    client = await mongoClient.connect(connectionString, mongoClientOptions);
    db = client.db(dbName);
    // Determine how many contacts currently exist
    let count = await db.collection(collectionName).countDocuments({});
    currentContacts = count;
    insertIntervalTimer = setInterval(insertContacts, insertInterval);
    consoleUpdateTimer = setInterval(updateConsole, 5000);
    throttleIntervalTimer = setInterval(() => {
      let heapSpaceStatistics = v8.getHeapSpaceStatistics();
      let lowHeapSpace = heapSpaceStatistics.some(
        (hss) =>
          hss.space_available_size < hss.space_size / 5 &&
          (hss.space_name === "code_space" || hss.space_name === "map_space")
      ); // Less than 20% remains
      // If we went this whole time without an error then try going faster
      if (
        !lowHeapSpace &&
        !inErrorState &&
        Date.now() - timeInErrorState >= insertInterval * 100 &&
        insertInterval > 1
      ) {
        // Speed up inserts by 1%
        insertInterval -= insertInterval / 100;
        console.log(
          `Lowering insert interval to ${insertInterval.toFixed(0)} ms`
        );
        clearInterval(insertIntervalTimer);
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
      }
    }, insertInterval * 200);
  } catch (err) {
    if (client) {
      client.close();
    }
    if (retryCount < maxRetries) {
      retryCount++;
      await sleep(Math.pow(retryCount,2)*1000); // Exponentially grow the amount of time we wait between retires
      console.log(`Retrying connection ${retryCount} of ${maxRetries}`);
      main();
    } else {
      console.log(err);
      process.exit(1);
    }
  }
};

const close = () => {
  clearInterval(consoleUpdateTimer);
  clearInterval(insertIntervalTimer);
  clearInterval(throttleIntervalTimer);
  client.close();
  console.log(`Currently inserted contacts = ${currentContacts}`);
  process.exit(0);
};

const insertContacts = () => {
  try {
    if (currentContacts >= numContactsToCreate) {
      close();
      return;
    }
    if (!inErrorState) {
      let contacts = [];
      for (let i = 0; i < batchSize; i++) {
        const firstName = faker.name.firstName().replace(/[^a-zA-Z ]/g, "");
        const lastName = faker.name.lastName().replace(/[^a-zA-Z ]/g, "");
        const contact = {
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          addresses: [
            {
              street: faker.address
                .streetAddress()
                .replace(/[^0-9a-zA-Z ]/g, ""),
              city: faker.address.city().replace(/[^a-zA-Z ]/g, ""),
              state: faker.address.stateAbbr(),
              zip: faker.address.zipCode(),
            },
          ],
          emails: [
            {
              email: faker.internet
                .email(firstName, lastName)
                .replace(/[^a-zA-Z@\. ]/g, ""),
            },
          ],
          phones: [
            {
              phoneNumber: faker.phone.phoneNumber(),
            },
          ],
        };
        contacts.push(contact);
      }
      db.collection(collectionName)
        .insertMany(contacts)
        .then((result) => {
          currentContacts += batchSize;
        })
        .catch((err) => {
          setErrorState(err);
        });
    }
  } catch {
    console.log(err);
    close();
  }
};

const setErrorState = (error) => {
  if (error && !inErrorState) {
    inErrorState = true;
    timeInErrorState = Date.now();
    // Do not leave this error state until a delay has passed
    let currentThrottleDelay = insertInterval * 100;
    if (error.code === 50) {
      currentThrottleDelay = insertInterval * 300;
      console.warn(
        `ExceededTimeLimit. Pausing for ${currentThrottleDelay.toFixed(0)} ms`
      );
    } else {
      console.error(error);
    }
    setTimeout(() => {
      inErrorState = false;
      timeInErrorState = Date.now();
    }, currentThrottleDelay);
    // Slow down future inserts by 5%
    insertInterval += insertInterval / 20;
    console.log(`Raising insert interval to ${insertInterval} ms`);
    clearInterval(insertIntervalTimer);
    insertIntervalTimer = setInterval(insertContacts, insertInterval);
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const updateConsole = () => {
  console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
};

main();
