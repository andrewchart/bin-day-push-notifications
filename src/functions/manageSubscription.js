const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


app.http('createSubscription', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'createSubscription',
    handler: async (request, context) => {

        let responseData = {
            status: 'Created'
        }

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;

        const { 
            auth,
            p256dh,
            endpoint,
            propertyNameOrNumber, 
            street, 
            postcode
        } = request.params;

        const partitionKey = 'subscriptions';
        const rowKey = auth;

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

        try {

            client.upsertEntity({ 
                partitionKey,
                rowKey, //auth
                p256dh,
                endpoint,
                propertyNameOrNumber, 
                street, 
                postcode
            }, "Replace");

        } catch(error) {
            responseData.status = 'Error';
        }

        return { body: JSON.stringify(responseData) };
    }
});


app.http('getSubscription', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'getSubscription/{authKey}',
    handler: async (request, context) => {

        const { authKey } = request.params;

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

        try {
            let result = await client.getEntity("subscriptions", authKey);
            return { body: JSON.stringify(result) };
        } catch(error) {
            return { body: JSON.stringify({}) };
        }

    }
});