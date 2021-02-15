'use strict';
/*
Setup SQL using the documentation provided in the setup-sql folder
*/

const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const sql = require('mssql');
const v8 = require('v8');

let connection = null;

const dbConfig = {
    server: args['sqlServer'] || process.env.sqlServer, // Make sure to pass these in, or set them in nodemon.json or the environment
    database: args['sqlDatabase'] || process.env.sqlDatabase, // Make sure to pass these in, or set them in nodemon.json or the environment
    user: args['sqlUser'] || process.env.sqlUser, // Make sure to pass these in, or set them in nodemon.json or the environment
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustedConnection: true,
        useUTC: true
    },
    password: args['sqlPassword'] || process.env.sqlPassword, // Make sure to pass these in, or set them in nodemon.json or the environment
    port: 1433

};


let batchSize = 200;
let insertInterval = 20;
const numContactsToCreate = 20000000;

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;
let inErrorState = false;
let timeInErrorState = Date.now();

const main = async () => {
    try {
        //Initiallising SQL connection string
        connection = await sql.connect(dbConfig);
        // Determine how many contacts currently exist
        let result = sql.query(`select count(*) as currentContacts from dbo.contacts`);
        currentContacts = result.recordset[0].currentContacts
        // Create contact
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
        consoleUpdateTimer = setInterval(updateConsole, 5000);
        throttleIntervalTimer = setInterval(() => {
            let heapSpaceStatistics = v8.getHeapSpaceStatistics()
            let lowHeapSpace = heapSpaceStatistics.some(hss => hss.space_available_size < hss.space_size / 5 && (hss.space_name === 'code_space' || hss.space_name === 'map_space')); // Less than 20% remains
            // If we went this whole time without an error then try going faster
            if(!lowHeapSpace && !inErrorState && Date.now() - timeInErrorState >= insertInterval * 100) {
                // Speed up inserts by 1%
                insertInterval -= (insertInterval/100);
                console.log(`Lowering insert interval to ${insertInterval.toFixed(0)} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContacts, insertInterval);
            }
        }, insertInterval * 200);
    } catch (err) {
        console.error(err);
        if(connection) {
            connection.close();
        }
    }
}

const close = () => {
    clearInterval(consoleUpdateTimer);
    clearInterval(insertIntervalTimer);
    clearInterval(throttleIntervalTimer);
    connection.close();
    console.log(`Currently inserted contacts = ${currentContacts}`);    
}

const insertContacts = () => {
    try {
        if(currentContacts>=numContactsToCreate) {
            close();
            return;
        }
        if(!inErrorState) {
            let query = 'declare @id int';
            for(let i = 0; i < batchSize; i++) {
                const firstName = faker.name.firstName().replace(/[^a-zA-Z ]/g, '');
                const lastName = faker.name.lastName().replace(/[^a-zA-Z ]/g, '');
                const displayName = `${firstName} ${lastName}`
                const street = faker.address.streetAddress().replace(/[^0-9a-zA-Z ]/g, '');
                const city = faker.address.city().replace(/[^a-zA-Z ]/g, '');;
                const state = faker.address.stateAbbr();
                const zip = faker.address.zipCode();
                const email = faker.internet.email(firstName, lastName).replace(/[^a-zA-Z@\. ]/g, '');;
                const phoneNumber = faker.phone.phoneNumber();
                query += `\ninsert into contacts (firstName,lastName,displayName) values ('${firstName}','${lastName}','${displayName}')`;
                query += `\nset @id=@@identity`;
                query += `\ninsert into addresses (contactId,street,city,state,zip) values (@id,'${street}','${city}','${state}','${zip}')`;
                query += `\ninsert into emails (contactId,email) values (@id,'${email}')`;
                query += `\ninsert into phones (contactId,phoneNumber) values (@id,'${phoneNumber}')`;
            }
            sql.query(query).then(result => {
                currentContacts += batchSize;
            }).catch(err => {
                setErrorState(err);
            });
        }
    } catch {
        console.log(err);
        close();
    }
}

const setErrorState = (error) => {
    if (error && !inErrorState) {
        inErrorState = true;
        timeInErrorState = Date.now();
        // Do not leave this error state until a delay has passed
        let currentThrottleDelay = insertInterval * 100;
        if(error.code === 50) {
            currentThrottleDelay = insertInterval * 300;
            console.warn(`ExceededTimeLimit. Pausing for ${currentThrottleDelay.toFixed(0)} ms`)
        } else {
            console.error(error);
        }
        setTimeout(() => {
            inErrorState = false;
            timeInErrorState = Date.now();
        }, currentThrottleDelay);
        // Slow down future inserts by 5%
        insertInterval += (insertInterval/20);
        console.log(`Raising insert interval to ${insertInterval} ms`);
        clearInterval(insertIntervalTimer);
        insertIntervalTimer = setInterval(insertContacts, insertInterval);
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

main();
