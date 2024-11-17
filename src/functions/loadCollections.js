const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


async function loadCollections(date, dateComparator = 'equals') {

    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_COLLECTIONS_TABLE_NAME
    } = process.env;

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_COLLECTIONS_TABLE_NAME, creds);

    let collections = [];

    let y = date.getUTCFullYear().toString();
    let m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    let d= (date.getUTCDate()).toString().padStart(2, "0");

    let operator;
    
    switch(dateComparator) {
        case 'equals':
            operator = 'eq';
            break;

        case 'before':
            operator = 'lt';
            break;

        default:
            operator = 'eq';
    }
    
    let results = await client.listEntities({
        queryOptions: {
            filter: `utcDate ${operator} datetime'${y}-${m}-${d}T00:00:00.000'`
        }
    });

    for await (const collection of results) {
        collections.push(collection);
    }

    return collections;

}

function loadCollectionsByDate(date) {
    return loadCollections(date, 'equals');
}

function loadCollectionsBefore(date) {
    return loadCollections(date, 'before');
}

module.exports = {
    loadCollectionsByDate,
    loadCollectionsBefore
}