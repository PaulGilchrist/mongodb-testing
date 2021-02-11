'use strict';
/*
Before running this code, run insertSql.js (and follow its setup steps)
Make sure to setup the appropriate indexes before running this code
CREATE INDEX idx_contacts_firstName on [dbo].[contacts] (firstName);
CREATE INDEX idx_contacts_lastName on [dbo].[contacts] (lastName);
CREATE INDEX idx_contacts_displayName on [dbo].[contacts] (displayName);
CREATE INDEX idx_addresses_street on [dbo].[addresses] (street);
CREATE INDEX idx_addresses_city on [dbo].[addresses] (city);
CREATE INDEX idx_addresses_state on [dbo].[addresses] (state);
CREATE INDEX idx_addresses_zip on [dbo].[addresses] (zip);
CREATE INDEX idx_emails_email on [dbo].[emails] (email);
CREATE INDEX idx_phones_phoneNumber on [dbo].[phones] (phoneNumber);

*/
const chalk = require('chalk'); // Add color to the console
const faker = require('faker/locale/en_US');
const args = require('minimist')(process.argv.slice(2)); // Get arguments by name rather than by index
const sql = require('mssql');
const util = require('util');

let connection = null;
const dbConfig = {
    server: args['server'] || process.env.server, // Make sure to pass these in, or set them in nodemon.json or the environment
    database: args['database'] || process.env.database, // Make sure to pass these in, or set them in nodemon.json or the environment
    user: args['user'] || process.env.user, // Make sure to pass these in, or set them in nodemon.json or the environment
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustedConnection: true,
        useUTC: true
    },
    password: args['password'] || process.env.password, // Make sure to pass these in, or set them in nodemon.json or the environment
    port: 1433

};

const main = async () => {
    //Initiallising SQL connection string
    try {
        connection = await sql.connect(dbConfig);
        // Find first 10 contacts both with a firstName and living in a given state (parent and child object)
        let startTime = new Date();
        let query = `select top 2 c.id, c.firstName, c.lastName, c.displayName, a.id as addressId, a.street, a.city, a.state, a.zip, e.id as emailId, e.email, p.id as phoneId, p.phoneNumber
            from dbo.contacts c
                inner join addresses a on a.contactId=c.id
                inner join emails e on e.contactId=c.id
                inner join phones p on p.contactId=c.id
            where c.firstName = 'Paul' and a.state = 'MI'`;
        let recordset = await sql.query(query)
            .then(result => result.recordset).catch(err => {
                console.log(err);
                connection.close();
            });
        // Transform from 2D to 3D representation
        const contacts = [];
        recordset.forEach(record => {
            // Does contact already exist?
            let foundContact = contacts.find(c => c.id === record.id);
            if (!foundContact) {
                contacts.push({
                    firstName: record.firstName,
                    lastName: record.lastName,
                    displayName: record.displayName,
                    addresses: [{street: record.street, city: record.city, state: record.state, zip: record.zip}],
                    emails: [{email: record.email}],
                    phones: [{phoneNumber: record.phoneNumber}]
                });
            } else {
                // The contact already existed, so either the address, email, or phone must be new
                // Does the address already exist?
                let foundAddress = foundContact.addresses.find(a => a.id === record.addressId);
                if (!foundAddress) {
                    foundContact.addresses.push({street: record.street, city: record.city, state: record.state, zip: record.zip});
                }
                // Does the email already exist?
                let foundEmail = foundContact.emails.find(e => e.id === record.emailId);
                if (!foundEmail) {
                    foundContact.emails.push({email: record.email});
                }
                // Does the phone already exist?
                let foundPhone = foundContact.phones.find(p => p.id === record.phoneId);
                if (!foundPhone) {
                    foundContact.phones.push({phoneNumber: record.phoneNumber});
                }
            }
        });
        // We now have the data in a JSON and object compatible model
        let endTime = new Date();
        let elapsedTime = endTime - startTime;
        if (contacts && contacts.length > 0) {
            console.log(chalk.cyan(`Documents where first name is 'Paul' and they live in Michigan. Limited to 2 results`));
            console.log(util.inspect(contacts, false, null, true /* enable colors */));
            console.log(chalk.cyan(`Elapsed time = ${elapsedTime} ms`));
        } else {
            console.error(`Document not found - find`);
        }
    } catch (err) {
        if (connection) {
            connection.close();
        }
        console.log(err);
    }
    connection.close();
}

main();
