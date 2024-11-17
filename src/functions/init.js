const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


app.http('init', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async () => {

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_COLLECTIONS_TABLE_NAME,
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const subscriptionsClient = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
        const collectionsClient = new TableClient(AZ_TABLE_STORAGE_URL, AZ_COLLECTIONS_TABLE_NAME, creds);
        
        subscriptionsClient.createTable();
        collectionsClient.createTable();

        return {
            body: JSON.stringify({ message: 'OK' }),
            status: 200
        }
    }    
});