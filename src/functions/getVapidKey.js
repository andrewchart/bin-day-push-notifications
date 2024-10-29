const { app } = require('@azure/functions');


app.http('getVapidKey', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async () => {
        return { body: process.env.VAPID_SERVER_KEY };
    }    
});