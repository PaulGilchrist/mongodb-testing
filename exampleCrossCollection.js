/*
Before running this code, run the docker command below to install and start mongodb (change DB path if needed)
    docker run -d -p 27017:27017 -v ~/Temp/mongo-testing/db:/data/db --name mongo-testing-db mongo:latest --replSet rs0
Next, connect to your running container through the Docker dashboard, run "mongo" shell, and initiate the new Replica Set using command "rs.initiate()"
    or remove the section of this code that demonstrates a transaction (transactions require a replica set, even if a set of 1 node
If building a multi-node replica set - https://www.sohamkamani.com/blog/2016/06/30/docker-mongo-replica-set/
    docker network create my-mongo-cluster
    docker run -d -p 30001:27017 --name mongo1 -v ~/Temp/mongo-testing/db:/data/db --net my-mongo-cluster mongo:latest --replSet my-mongo-set
    docker run -d -p 30002:27017 --name mongo2 -v ~/Temp/mongo-testing/db:/data/db --net my-mongo-cluster mongo:latest --replSet my-mongo-set
    docker run -d -p 30003:27017 --name mongo3 -v ~/Temp/mongo-testing/db:/data/db --net my-mongo-cluster mongo:latest --replSet my-mongo-set
    Run the following command from the terminal on mongo1
        > db = (new Mongo('localhost:27017')).getDB('crossCollection')
        test
        > config = {
            "_id" : "my-mongo-set",
            "members" : [
                {
                    "_id" : 0,
                    "host" : "mongo1:27017"
                },
                {
                    "_id" : 1,
                    "host" : "mongo2:27017"
                },
                {
                    "_id" : 2,
                    "host" : "mongo3:27017"
                }
            ]
        }
        > rs.initiate(config)
        { "ok" : 1 }
    Better would be to use Kubernetes or docker-compose
*/
const chalk = require('chalk');
const fs = require('fs');
const mongoClient = require('mongodb').MongoClient;
const util = require('util');

// Global variables
let client = null;
let db = null;
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
const connectionString = 'mongodb://localhost:27017/'; // default mongo port

const main = async () => {
    try {
        await initDatabase();
        // Transaction based upsert/update
        let state = await db.collection('states').findOne({name: 'Michigan'});
        const session = client.startSession();        
        try {
            await session.withTransaction(async () => {
                // Important:: You must pass the session to the operations
                await db.collection('cities').insertOne({ name: 'Flint', stateId: state._id }, { session });
                await db.collection('cities').insertOne({ name: 'Grand Rapids', stateId: state._id }, { session });
            }, transactionOptions);
        } catch {
            console.log('Transaction failes')
        } finally {
            await session.endSession();
        }
        console.log(chalk.cyan('Completed transaction based upsert/update'));

        // Cross collection query - Bottom up
        result = await db.collection('cities').aggregate([
            {$match: {name: 'Detroit'}},
            {
                $lookup: {
                    from: 'states', // Join
                    let: {childId: '$stateId'},
                    as: 'state',
                    pipeline: [
                        {$match: {$expr: {$eq: ['$_id', '$$childId']}}}, // on state._id = city.stateId
                        {
                            $lookup: {
                                from: 'countries', // Join
                                let: {childId: '$countryId' },
                                as: 'country',
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$_id', '$$childId']}}}, // on country._id = state.countryId
                                    {
                                        $lookup: {
                                            from: 'continents', // Join
                                            let: {childId: '$continentId'},
                                            as: 'continent',
                                            pipeline: [
                                                { $match: {$expr: {$eq: ['$_id', '$$childId']}}}, // on continent._id = country.continentId
                                                {$project: {_id: 0, name: 1}}
                                            ]
                                        }
                                    },
                                    {$unwind: '$continent'}, // We know only one will be returned so don't wrap in an array
                                    {$project: {_id: 0, name: 1, continent: 1}}
                                ]
                            }
                        },
                        {$unwind: '$country'}, // We know only one will be returned so don't wrap in an array
                        {$project: {_id: 0, name: 1, country: 1}}
                    ]
                }
            },
            {$unwind: '$state'}, // We know only one will be returned so don't wrap in an array
            {$project: {_id: 0, name: 1, state: 1}}
        ]).toArray();
        console.log(chalk.cyan('Cross collection query - Bottom up (IDs removed)'));
        console.log(util.inspect(result, false, null, true /* enable colors */));
        // Cross collection query - Top down
        result = await db.collection('continents').aggregate([
            {
                $lookup: {
                    from: 'countries', // Join
                    let: {parentId: '$_id'},
                    as: 'countries',
                    pipeline: [
                        {$match: {$expr: {$eq: ['$continentId', '$$parentId']}}}, // on country.continentId = continent._id
                        {
                            $lookup: {
                                from: 'states', // Join
                                let: {parentId: '$_id'},
                                as: 'states',
                                pipeline: [
                                    { $match: {$expr: {$eq: ['$countryId', '$$parentId']}}}, // on state.countryId = country._id
                                    {
                                        $lookup: {
                                            from: 'cities', // Join
                                            let: {parentId: '$_id'},
                                            as: 'cities',
                                            pipeline: [
                                                {$match: {$expr: {$eq: ['$stateId', '$$parentId']}}}, // on city.stateId = state._id
                                                {$project: {_id: 0, name: 1}}
                                            ]
                                        }
                                    },
                                    {$project: {_id: 0, name: 1, cities: 1}}
                                ]
                            }
                        },
                        {$project: {_id: 0, name: 1, states: 1}}
                    ]
                }
            },
            {$project: {_id: 0, name: 1, countries: 1}}
        ]).toArray();
        console.log(chalk.cyan('Cross collection query - Top down (IDs removed)'));
        console.log(util.inspect(result, false, null, true /* enable colors */));
        client.close();
        console.log(chalk.cyan('Database closed'));
    } catch (err) {
        if (client) {
            client.close();
        }
        console.log(err);
    }
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

const initDatabase = async () => {
    try {
        // Create or connect to database
        client = await mongoClient.connect(connectionString, mongoClientOptions);
        console.log(chalk.cyan('Database connected'));
        db = client.db(dbName);
        // Drop collections
        await dropCollection(db, 'cities');
        await dropCollection(db, 'states');
        await dropCollection(db, 'countries');
        await dropCollection(db, 'continents');
        console.log(chalk.cyan('Any existing collections dropped'));
        // Insert documents
        let continent = await db.collection('continents').insertOne({ 'name': 'North America' });
        let country = await db.collection('countries').insertOne({ 'continentId': continent.insertedId, 'name': 'Canada' });
        let state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Manitoba' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Ontario' });
        let city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Toronto' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Quebec' });
        country = await db.collection('countries').insertOne({ 'continentId': continent.insertedId, 'name': 'United States' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Arizona' });
        city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Phoenix' });
        city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Tempe' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Georgia' });
        city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Atlanta' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Michigan' });
        city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Detroit' });
        continent = await db.collection('continents').insertOne({ 'name': 'South America' });
        country = await db.collection('countries').insertOne({ 'continentId': continent.insertedId, 'name': 'Brazil' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Bahia' });
        city = await db.collection('cities').insertOne({ 'stateId': state.insertedId, 'name': 'Salvador' });
        state = await db.collection('states').insertOne({ 'countryId': country.insertedId, 'name': 'Rio De Janeiro' });
        console.log(chalk.cyan('Continent documents inserted'));
        result = await db.collection('continents').find({}).sort({ 'name': 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan('Country documents inserted'));
        result = await db.collection('countries').find({}).sort({ 'name': 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan('State documents inserted'));
        result = await db.collection('states').find({}).sort({ 'name': 1 }).toArray();
        console.log(result);
        console.log(chalk.cyan('City documents inserted'));
        result = await db.collection('cities').find({}).sort({ 'name': 1 }).toArray();
        console.log(result);
        // Create indexes
        db.collection('countries').createIndex('continentId');
        db.collection('states').createIndex('countryId');
        db.collection('cities').createIndex('stateId');
        console.log(chalk.cyan('Indexes added'));
    } catch(err) {
        if(client) {
            client.close();
        }
        console.log(err);
    }
}

const throwError = (err, client) => {
    client.close();
    throw err;
}

main();
