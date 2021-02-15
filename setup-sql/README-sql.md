# SQL Setup

Follow the below steps to generate the same database schema as used in the MongoDB tests.

If you do not laready have SQL installed locally, you can either download it from [here](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) or better yet, just run it from within a Docker container.

```
docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=Passw0rd -p 1433:1433' -e 'MSSQL_PID=Standard' -d mcr.microsoft.com/mssql/server:2019-latest
```
* Must run this on amd64 architecture (Mac M1 ARM64 not supported)

Connect to Database using [SSMS](https://docs.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms?view=sql-server-ver15) or [Azure Data Studio](https://docs.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio?view=sql-server-ver15) and create the needed tables (without indexes initially).

```sql
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
```

Follow by adding to or creating a `nodemon.json` file with the below environment variables:

```json
{
    "env": {
        "sqlDatabase": "test",
        "sqlPassword": "Passw0rd",
        "sqlServer": "localhost",
        "sqlUser": "sa"
    }
}
```

You will start the record insert process using the command `npm run insertSql`.  It will take quite a while to insert the 20 million rows, but the program can be stopped and restarted at any time and it will resume where it left off.  You can later check that records are being inserted successfully with the following query

```sql
select c.id, c.firstName, c.lastName, a.street, a.city, a.state, a.zip, e.email, p.phoneNumber
    from dbo.contacts c
        left outer join addresses a on a.contactId=c.id
        left outer join emails e on e.contactId=c.id
        left outer join phones p on p.contactId=c.id
```

Once all records have been inserted, add indexes on at least the firstName, state, and all contactId columns.

```sql
CREATE INDEX idx_contacts_firstName on [dbo].[contacts] (firstName);
CREATE INDEX idx_contacts_lastName on [dbo].[contacts] (lastName);
CREATE INDEX idx_contacts_displayName on [dbo].[contacts] (displayName);
CREATE INDEX idx_addresses_street on [dbo].[addresses] (street);
CREATE INDEX idx_addresses_city on [dbo].[addresses] (city);
CREATE INDEX idx_addresses_state on [dbo].[addresses] (state);
CREATE INDEX idx_addresses_zip on [dbo].[addresses] (zip);
CREATE INDEX idx_emails_email on [dbo].[emails] (email);
CREATE INDEX idx_phones_phoneNumber on [dbo].[phones] (phoneNumber);
```

Now you are ready to run the performance test using the command `npm run perfTestSql`