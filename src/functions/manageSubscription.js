const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


app.http('createSubscription', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'createSubscription',
    handler: async (request, context) => {

        let response = {
            body: JSON.stringify({ message: 'OK' }),
            status: 201
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

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

        await client.upsertEntity({ 
            partitionKey,
            rowKey: encodeURIComponent(auth), //use auth as a unique key, but Azure require urlencoding
            auth,
            p256dh,
            endpoint,
            propertyNameOrNumber, 
            street, 
            postcode,
            validAddress: true
        }, "Replace").catch((error) => {
            response.body = JSON.stringify({ message: 'Failed' });
            response.status = 500;
        });
        
        return response;
        
    }
});


app.http('getSubscription', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'getSubscription',
    handler: async (request, context) => {

        const { key } = request.params;

        let response = {
            body: null,
            status: null
        }

        if(!key || key.trim().length === 0) {
            response.status = 400;
            response.body = JSON.stringify({ message: 'Bad request' });
            return response;
        } 

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
        
        // erm... certain characters including "/" are url encoded in request params above. Without
        // the inner decode, you get double encoding and the query fails. 
        const query = encodeURIComponent(decodeURIComponent(key));

        await client.getEntity("subscriptions", query).then((result) => {
            response.status = 200;
            response.body = JSON.stringify(result);
        }).catch((error) => {
            response.status = error.statusCode;
            response.body = JSON.stringify({ message: 'Failed' });
        });

        return response;

    }
});


app.http('deleteSubscription', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'deleteSubscription',
    handler: async (request, context) => {

        let { key } = await request.json();

        let response = {
            body: JSON.stringify({ message: 'Deleted' }),
            status: 200
        }

        if(!key || key.trim().length === 0) {
            response.status = 400;
            response.body = JSON.stringify({ message: 'Bad request' });
            return response;
        } 

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_SUBSCRIPTIONS_TABLE_NAME,
            AZ_COLLECTIONS_TABLE_NAME
        } = process.env;

        const subscriptionKey = encodeURIComponent(decodeURIComponent(key));

        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const subscriptionsClient = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
        const collectionsClient = new TableClient(AZ_TABLE_STORAGE_URL, AZ_COLLECTIONS_TABLE_NAME, creds);

        await subscriptionsClient.deleteEntity('subscriptions', subscriptionKey).then(async () => {

            let allCollections = await collectionsClient.listEntities({
                queryOptions: {
                    filter: `PartitionKey eq '${subscriptionKey}'`
                }
            });

            for await (const collection of allCollections) {
                collectionsClient.deleteEntity(subscriptionKey, collection.rowKey);
            }

        }).catch((error) => {
            response.body = JSON.stringify({ message: 'Failed' });
            response.status = error.statusCode;
        });
        
        return response;
        
    }
});