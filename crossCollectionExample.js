
// Before running this code, run the docker command below to install and start mongodb (change DB path if needed)
// docker run -d -p 27017:27017 -v ~/Temp/mongo-testing/db:/data/db --name mongo-testing-db mongo:latest

const chalk = require('chalk');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const util = require('util');

// Global variables
const dbName = 'crossCollection';
const mongoClientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};
const transactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 'majority' }
};
const url = 'mongodb://localhost:27017/'; // default mongo port

const createDatabase = async (url, mongoClientOptions) => {
    return MongoClient.connect(url, mongoClientOptions);
}

const createCollection = async (db, collectionName) => {
    let response = {};
    try {
        response = await db.createCollection(collectionName);
    } catch (err) {
        if (err && err.codeName != 'NamespaceExists') {
            throw err;
        }
    }
    return response;
}

const dropCollection = async (db, collectionName) => {
    let dropSuccess = false;
    try {
        dropSuccess = await db.collection(collectionName).drop();
    } catch (err) {
        if (err && err.codeName != 'NamespaceNotFound') {
            throw err;
        } else {
            dropSuccess = true;
        }
    }
    return dropSuccess;
}

const throwError = (err, client) => {
    client.close();
    throw err;
}

const main = async () => {
    let client = null;
    try {
        // Create or connect to database
        client = await createDatabase(url, mongoClientOptions);
        console.log(chalk.cyan("Database connected"));
        const db = client.db(dbName);
        // Insert documents
        let continent = await db.collection('continents').insertOne({ "name": "North America" });
        let country = await db.collection('countries').insertOne({ "continentId": continent.insertedId, "name": "Canada" });
        let state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Manitoba" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Ontario" });
        let city = await db.collection('cities').insertOne({ "stateId": state.insertedId, "name": "Toronto" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Quebec" });
        country = await db.collection('countries').insertOne({ "continentId": continent.insertedId, "name": "United States" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Arizona" });
        city = await db.collection('cities').insertOne({ "stateId": state.insertedId, "name": "Phoenix" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Georgia" });
        city = await db.collection('cities').insertOne({ "stateId": state.insertedId, "name": "Atlanta" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Michigan" });
        city = await db.collection('cities').insertOne({ "stateId": state.insertedId, "name": "Detroit" });
        continent = await db.collection('continents').insertOne({ "name": "South America" });
        country = await db.collection('countries').insertOne({ "continentId": continent.insertedId, "name": "Brazil" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Bahia" });
        city = await db.collection('cities').insertOne({ "stateId": state.insertedId, "name": "Salvador" });
        state = await db.collection('states').insertOne({ "countryId": country.insertedId, "name": "Rio De Janeiro" });
        console.log(chalk.cyan("Continent documents inserted"));
        result = await db.collection('continents').find({}).sort({ "name": 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan("Country documents inserted"));
        result = await db.collection('countries').find({}).sort({ "name": 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan("State documents inserted"));
        result = await db.collection('states').find({}).sort({ "name": 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan("City documents inserted"));
        result = await db.collection('cities').find({}).sort({ "name": 1 }).toArray();
        console.log(result);
        // Cross collection query
        result = await db.collection('continents').aggregate([
            {
                "$lookup": {
                    "from": "countries",
                    "let": { "continentId": "$_id" },
                    "pipeline": [
                        { "$match": { "$expr": { "$eq": ["$continentId", "$$continentId"] } } },
                        {
                            "$lookup": {
                                "from": "states",
                                "let": { "countryId": "$_id" },
                                "pipeline": [
                                    { "$match": { "$expr": { "$eq": ["$countryId", "$$countryId"] } } },
                                    {
                                        "$lookup": {
                                            "from": "cities",
                                            "let": { "stateId": "$_id" },
                                            "pipeline": [
                                                { "$match": { "$expr": { "$eq": ["$stateId", "$$stateId"] } } }
                                            ],
                                            "as": "cities"
                                        }
                                    }                                ],
                                "as": "states"
                            },
                        }
                    ],
                    "as": "countries"
                }
            }
        ]).toArray();
        console.log(chalk.cyan("Cross collection query"));
        console.log(util.inspect(result, false, null, true /* enable colors */));



        // Delete documents
        response = await db.collection('cities').deleteMany({});
        response = await db.collection('states').deleteMany({});
        response = await db.collection('countries').deleteMany({});
        response = await db.collection('continents').deleteMany({});
        console.log(chalk.cyan("Documents deleted"));
        // Drop collection
        await dropCollection(db, 'countries');
        await dropCollection(db, 'continents');
        console.log(chalk.cyan("Collections dropped"));
        client.close();
        console.log(chalk.cyan("Database closed"));
    } catch (err) {
        if (client) {
            client.close();
        }
        console.log(err);
    }
}
main();
