const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


app.http('markInvalidAddress', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'markInvalidAddress/{rowKey}',
    handler: async (request, context) => {

        let response = {
            body: JSON.stringify({ message: 'OK' }),
            status: 200
        }

        const {
            AZ_ACCOUNT_NAME,
            AZ_ACCOUNT_KEY,
            AZ_TABLE_STORAGE_URL,
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;

        const { rowKey } = request.params;

        context.log('markInvalidAddress.js:25 rowKey', rowKey);
        context.log('markInvalidAddress.js:26 encodeURIComponent(rowKey)', encodeURIComponent(rowKey));

    
        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
    
        await client.updateEntity({ 
            partitionKey: 'subscriptions',
            rowKey: encodeURIComponent(rowKey), 
            validAddress: false 
        }, "Merge").catch((error) => {
            console.log(error);
            response.body = JSON.stringify({ message: 'Failed' });
            response.status = error.statusCode;
        });

        return response;
    }    
});