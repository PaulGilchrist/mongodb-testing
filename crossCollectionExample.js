
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
        let result = await db.collection('continents').insertOne({"name":"North America"});
        result = await db.collection('countries').insertOne({"continentId": result.insertedId,"name":"Canada"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Manitoba"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Ontario"});
        result = await db.collection('cities').insertOne({"stateId": result.insertedId,"name":"Toronto"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Quebec"});   
        result = await db.collection('countries').insertOne({"continentId": result.insertedId,"name":"United States"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Arizona"});
        result = await db.collection('cities').insertOne({"stateId": result.insertedId,"name":"Phoenix"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Georgia"});
        result = await db.collection('cities').insertOne({"stateId": result.insertedId,"name":"Atlanta"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Michigan"});
        result = await db.collection('cities').insertOne({"stateId": result.insertedId,"name":"Detroit"});
        result = await db.collection('continents').insertOne({"name":"South America"});
        result = await db.collection('countries').insertOne({"continentId": result.insertedId,"name":"Brazil"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Bahia"});
        result = await db.collection('cities').insertOne({"stateId": result.insertedId,"name":"Salvador"});
        result = await db.collection('states').insertOne({"countryId": result.insertedId,"name":"Rio De Janeiro"});
        console.log(chalk.cyan("Continent documents inserted"));
        result = await db.collection('continents').find({}).sort({"name": 1}).toArray();
        console.log(result);
        console.log(chalk.cyan("Country documents inserted"));
        result = await db.collection('countries').find({}).sort({"name": 1}).toArray();
        console.log(result);
        console.log(chalk.cyan("State documents inserted"));
        result = await db.collection('states').find({}).sort({"name": 1}).toArray();
        console.log(result);
        console.log(chalk.cyan("City documents inserted"));
        result = await db.collection('cities').find({}).sort({"name": 1}).toArray();
        console.log(result);
        // Cross collection query
        result = await db.collection('states').aggregate([
            {
                $lookup: {
                    from: "cities",
                    localField: "_id",
                    foreignField: "stateId",
                    as: "cities"
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
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}
main();
