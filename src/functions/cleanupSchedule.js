const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { loadCollectionsBefore } =  require('./loadCollections.js');

app.timer('cleanupSchedule', {
    schedule: '0 0 1 * * 6',
    handler: async (myTimer, context) => {
        cleanCollections();
        cleanStaleSubscriptions();
        return true;
    }
});


async function cleanCollections() {

    const TODAY = new Date();

    let pastCollections = await loadCollectionsBefore(TODAY);

    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_COLLECTIONS_TABLE_NAME
    } = process.env;

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_COLLECTIONS_TABLE_NAME, creds);
    
    for await (const collection of pastCollections) {
        client.deleteEntity(collection.partitionKey, collection.rowKey);
    }

    return true;

}

async function cleanStaleSubscriptions() {

    const {
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_SUBSCRIPTIONS_TABLE_NAME,
        AZ_HTTP_FUNC_BASE_URL
    } = process.env;

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

    const NOW = new Date();
    const FOUR_WEEKS_AGO = new Date(NOW - 2.419e+9);

    let y = FOUR_WEEKS_AGO.getUTCFullYear().toString();
    let m = (FOUR_WEEKS_AGO.getUTCMonth() + 1).toString().padStart(2, "0");
    let d = FOUR_WEEKS_AGO.getUTCDate().toString().padStart(2, "0");

    let results = await client.listEntities({
        queryOptions: {
            filter: `lastClientAcknowledgement lt datetime'${y}-${m}-${d}T00:00:00.000'`
        }
    });

    for await (const subscription of results) {
        client.deleteEntity(subscription.partitionKey, subscription.rowKey);

        fetch(`${AZ_HTTP_FUNC_BASE_URL}/api/deleteSubscription`, { 
            method: 'delete',
            body: JSON.stringify({ key: subscription.rowKey })
        }).catch(error => {});
    }

}