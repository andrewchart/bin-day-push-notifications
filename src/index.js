const { app } = require('@azure/functions');
const deployStaticContent = require('./site/deployStaticContent.js');

app.setup({
    enableHttpStream: true,
});

// Deploys the webpage where users can subscribe to notifications
deployStaticContent();