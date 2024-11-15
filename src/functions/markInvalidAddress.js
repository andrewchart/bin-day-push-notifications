const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");


app.http('markInvalidAddress', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'markInvalidAddress',
    handler: async (request, context) => {

        let { key } = await request.json();

        let response = {
            body: JSON.stringify({ message: 'OK' }),
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
            AZ_SUBSCRIPTIONS_TABLE_NAME
        } = process.env;
    
        const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
        const client = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);
    
        await client.updateEntity({ 
            partitionKey: 'subscriptions',
            rowKey: encodeURIComponent(key), 
            validAddress: false 
        }, "Merge").catch((error) => {
            context.log(error);
            response.body = JSON.stringify({ message: 'Failed' });
            response.status = error.statusCode;
        });

        return response;
    }    
});