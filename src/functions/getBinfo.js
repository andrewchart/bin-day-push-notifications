const { app } = require('@azure/functions');

app.timer('getBinfo', {
    schedule: '0 0 1 * * 1',
    handler: (myTimer, context) => {
        context.log('Hello Binfo.');
    }
});
