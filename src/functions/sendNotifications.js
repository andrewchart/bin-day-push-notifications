const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { NotificationHubsClient, createBrowserNotification } = require('@azure/notification-hubs');


app.timer('sendNotifications', {
    schedule: '0 */6 11 * * *',
    handler: async function(myTimer, context) {

        let now = new Date();
        let tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getDate() + 1));
        
        const tomorrowsCollections = await loadCollectionsByDate(tomorrow);

        let collectionsGroupedBySubscription = {};

        tomorrowsCollections.forEach((collection) => {

            if(!collectionsGroupedBySubscription[collection.partitionKey]) {
                collectionsGroupedBySubscription[collection.partitionKey] = [];
            }

            collectionsGroupedBySubscription[collection.partitionKey].push(collection);

        });

        for(key in collectionsGroupedBySubscription) {
            sendNotification(key, collectionsGroupedBySubscription[key]);
        }
        
    }
});


async function loadCollectionsByDate(date) {

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
    
    let results = await client.listEntities({
        queryOptions: {
            filter: `utcDate eq datetime'${y}-${m}-${d}T00:00:00.000'`
        }
    });

    for await (const collection of results) {
        collections.push(collection);
    }

    return collections;

}


async function sendNotification(subscriptionRowKey, collectionsGroup) {

    const { 
        AZ_NOTIFICATION_HUB_CONNECTION_STRING,
        AZ_NOTIFICATION_HUB_NAME,
        AZ_ACCOUNT_NAME,
        AZ_ACCOUNT_KEY,
        AZ_TABLE_STORAGE_URL,
        AZ_SUBSCRIPTIONS_TABLE_NAME,
        AZ_HTTP_FUNC_BASE_URL
    } = process.env;

    const creds = new AzureNamedKeyCredential(AZ_ACCOUNT_NAME, AZ_ACCOUNT_KEY);
    const tableClient = new TableClient(AZ_TABLE_STORAGE_URL, AZ_SUBSCRIPTIONS_TABLE_NAME, creds);

    let subscription = await tableClient.getEntity("subscriptions", subscriptionRowKey);
    

    const notificationClient = new NotificationHubsClient(AZ_NOTIFICATION_HUB_CONNECTION_STRING, AZ_NOTIFICATION_HUB_NAME);

    let tag = collectionsGroup[0].rowKey;

    let collections = collectionsGroup.map(collection => collection.description);

    let collDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    }).format(collectionsGroup[0].utcDate);
    
    let msgBody; 
    
    if(collections.length > 3) {
        msgBody = collections.slice(0,2).join('\n') + '\n'
        + `...and ${collections.length - 2} other collections`;
    } else {
        msgBody = collections.join('\n');
    }
    
    const notification = createBrowserNotification({
        body: { 
            title: `Collections tomorrow (${collDate})`,
            text: msgBody,
            data: {
                subscriptionRowKey,
                pushReceivedUrl: AZ_HTTP_FUNC_BASE_URL + '/api/pushReceived',
                tag
            }
        } 
    });

    let { endpoint, auth, p256dh } = subscription;

    return notificationClient.sendNotification(notification, {
        deviceHandle: { endpoint, auth, p256dh }
    }).then(() => {
        tableClient.updateEntity({ 
            partitionKey: 'subscriptions',
            rowKey: subscriptionRowKey, 
            lastAttemptedPush: new Date() 
        }, "Merge");
    });

}