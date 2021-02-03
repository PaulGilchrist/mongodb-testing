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
let consoleUpdateTimer = 0;
let currentContacts = 0;
let errorThrottleDelay = 10000;
let inErrorState = false;
const numContactsToCreate = 20000000;
let insertInterval = 1;
let insertIntervalTimer = null;
let throttleIntervalTimer = null
let throttleAdaptationDelay = 30000
let maxInsertInterval = 20;
let minInsertInterval = 1;
let timeInErrorState = Date.now();

const main = () => {
    //Initiallising SQL connection string
    sql.connect(dbConfig).then(() => {
        // Determine how many contacts currently exist
        sql.query(`select count(*) as currentContacts from dbo.contacts`).then(result => {
            currentContacts = result.recordset[0].currentContacts
            // Create contact
            insertIntervalTimer = setInterval(insertContact, insertInterval);
            consoleUpdateTimer = setInterval(updateConsole, 1000);
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
        currentContacts++;
        const firstName = faker.name.firstName().replace(/[^a-zA-Z ]/g, '');
        const lastName = faker.name.lastName().replace(/[^a-zA-Z ]/g, '');
        const displayName = `${firstName} ${lastName}`
        const street = faker.address.streetAddress().replace(/[^a-zA-Z ]/g, '');
        const city = faker.address.city().replace(/[^a-zA-Z ]/g, '');;
        const state = faker.address.stateAbbr();
        const zip = faker.address.zipCode();
        const email = faker.internet.email(firstName, lastName).replace(/[^a-zA-Z ]/g, '');;
        const phoneNumber = faker.phone.phoneNumber();
        let query = `declare @id int`;
        query += `\ninsert into contacts (firstName,lastName,displayName) values ('${firstName}','${lastName}','${displayName}')`;
        query += `\nset @id=@@identity`;
        query += `\ninsert into addresses (contactId,street,city,state,zip) values (@id,'${street}','${city}','${state}','${zip}')`;
        query += `\ninsert into emails (contactId,email) values (@id,'${email}')`;
        query += `\ninsert into phones (contactId,phoneNumber) values (@id,'${phoneNumber}')`;
        sql.query(query).then(result => {
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
                insertInterval++;
                console.log(`Raising insert interval to ${insertInterval} ms`);
                clearInterval(insertIntervalTimer);
                insertIntervalTimer = setInterval(insertContact, insertInterval);
            }
            // console.log(`Throttling for ${errorThrottleDelay} ms`);
            setTimeout(() => {
                setErrorState(false);
                // console.log(`Current insert interval = ${insertInterval} ms`);
            }, errorThrottleDelay);
        }
    }
}

const updateConsole = () => {
    console.log(`Inserting ${currentContacts} of ${numContactsToCreate}`);
}

main();
