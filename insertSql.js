'use strict';

/*
https://hub.docker.com/_/microsoft-mssql-server
Must run this on amd64 architecture (Mac M1 ARM64 not supported)
docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=Passw0rd -p 1433:1433' -e 'MSSQL_PID=Standard' -d mcr.microsoft.com/mssql/server:2019-latest
connect to Database using SSMS or Azure Data Studio and create the needed tables (without indexes at this stage)
CREATE TABLE [dbo].[contacts] (
    [id] INT IDENTITY (1, 1) NOT NULL,
    [firstName] NVARCHAR (50) NOT NULL,
    [lastName] NVARCHAR (50) NOT NULL,
    [displayName] NVARCHAR (200) NULL,
    CONSTRAINT [pk_contacts] PRIMARY KEY CLUSTERED ([id] ASC)
);
GO
CREATE TABLE [dbo].[addresses] (
    [id] INT IDENTITY (1, 1) NOT NULL,
    [contactId] INT NOT NULL,
    [street] NVARCHAR (50) NOT NULL,
    [city] NVARCHAR (50) NOT NULL,
    [state] NVARCHAR (50) NOT NULL,
    [zip] NVARCHAR (10) NOT NULL,
    CONSTRAINT [pk_addresses] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [fk_addresses_contacts] FOREIGN KEY ([contactId]) REFERENCES [dbo].[contacts] ([id])
);
GO
CREATE TABLE [dbo].[emails] (
    [id] INT IDENTITY (1, 1) NOT NULL,
    [contactId] INT NOT NULL,
    [email] NVARCHAR (50) NOT NULL,
    CONSTRAINT [pk_emails] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [fk_emails_contacts] FOREIGN KEY ([contactId]) REFERENCES [dbo].[contacts] ([id])
);
GO
CREATE TABLE [dbo].[phones] (
    [id] INT IDENTITY (1, 1) NOT NULL,
    [contactId] INT NOT NULL,
    [phoneNumber] NVARCHAR (50) NOT NULL,
    CONSTRAINT [pk_phones] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [fk_phones_contacts] FOREIGN KEY ([contactId]) REFERENCES [dbo].[contacts] ([id])
);
GO
You can later check that records are being inserted successfully with the following query
select c.id, c.firstName, c.lastName, a.street, a.city, a.state, a.zip, e.email, p.phoneNumber
    from dbo.contacts c
        left outer join addresses a on a.contactId=c.id
        left outer join emails e on e.contactId=c.id
        left outer join phones p on p.contactId=c.id

This file completed 80 million rows in around 24 hours with 8 vCPU and 24GB memory (running about 45% utilized)
    Need to test again, as SQL was remote (Azuer SQL Database), where Mongo was local, however network load was under 10%
*/

const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const sql = require('mssql');

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
let consoleUpdateDelay = 5000;
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
        consoleUpdateTimer = setInterval(updateConsole, consoleUpdateDelay);
        throttleIntervalTimer = setInterval(() => {
            // If we went this whole time without an error then try going faster
            if(!inErrorState && Date.now() - timeInErrorState >= insertInterval * 100) {
                // Speed up inserts by 1%
                insertInterval -= (insertInterval/100);
                console.log(`Lowering insert interval to ${insertInterval} ms`);
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
