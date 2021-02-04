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

const chalk = require('chalk'); // Add color to the console
const faker = require('faker/locale/en_US');
const sql = require('mssql');
const util = require('util');

const dbConfig = {
    server: 'mongotest.database.windows.net',
    database: 'test',
    user: 'pgilchrist',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustedConnection: true,
        useUTC: true
    },
    password: 'Passw)rd',
    port: 1433

};
let batchSize = 200;
let consoleUpdateDelay = 5000;
let errorThrottleDelay = 30000;
let throttleAdaptationDelay = 60000

let insertInterval = 20;
let maxInsertInterval = 250;
let minInsertInterval = 20;

let consoleUpdateTimer = null;
let insertIntervalTimer = null;
let throttleIntervalTimer = null

let currentContacts = 0;
const numContactsToCreate = 20000000;

let inErrorState = false;
let timeInErrorState = Date.now();

const main = () => {
    //Initiallising SQL connection string
    sql.connect(dbConfig).then(() => {
        // Determine how many contacts currently exist
        sql.query(`select count(*) as currentContacts from dbo.contacts`).then(result => {
            currentContacts = result.recordset[0].currentContacts
            // Create contact
            insertIntervalTimer = setInterval(insertContact, insertInterval);
            consoleUpdateTimer = setInterval(updateConsole, consoleUpdateDelay);
            throttleIntervalTimer = setInterval(() => {
                // If we went this whole time without an error then try going faster
                if(!inErrorState && Date.now() - timeInErrorState >= errorThrottleDelay*10 && insertInterval>minInsertInterval) {
                    insertInterval--;
                    console.log(`Lowering insert interval to ${insertInterval} ms`);
                    clearInterval(insertIntervalTimer);
                    insertIntervalTimer = setInterval(insertContact, insertInterval);
                }
            }, throttleAdaptationDelay);
        }).catch(err => {
            console.log(err);
        });
    }).catch((err) => {
        console.error(`SQL connection error`);
        console.error(err);
    });
}

const insertContact = () => {
    if(currentContacts>=numContactsToCreate) {
        clearInterval(consoleUpdateTimer);
        clearInterval(insertIntervalTimer);
        clearInterval(throttleIntervalTimer);
        return;
    }
    if(!inErrorState) {
        let query = 'declare @id int';
        for(let i = 0; i < batchSize; i++) {
            const firstName = faker.name.firstName().replace(/[^a-zA-Z ]/g, '');
            const lastName = faker.name.lastName().replace(/[^a-zA-Z ]/g, '');
            const displayName = `${firstName} ${lastName}`
            const street = faker.address.streetAddress().replace(/[^a-zA-Z ]/g, '');
            const city = faker.address.city().replace(/[^a-zA-Z ]/g, '');;
            const state = faker.address.stateAbbr();
            const zip = faker.address.zipCode();
            const email = faker.internet.email(firstName, lastName).replace(/[^a-zA-Z ]/g, '');;
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
            setErrorState(true);
        });
    }
}

const setErrorState = (state) => {
    if(state!=inErrorState) {
        inErrorState = state;
        timeInErrorState = Date.now();
        if(inErrorState) {
            // We have an error so slow down
            if(insertInterval<maxInsertInterval) {
                insertInterval += 5;
                console.log(`Raising insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContact, insertInterval);
            }
            setTimeout(() => {
                setErrorState(false);
            }, errorThrottleDelay);
        }
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

main();
