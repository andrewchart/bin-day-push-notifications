const { app } = require('@azure/functions');
const { NotificationHubsClient, createBrowserNotification } = require('@azure/notification-hubs');


app.timer('sendNotifications', {
    schedule: '0 0 1 * * 1',
    handler: async function(myTimer, context) {

        const { 
            AZ_NOTIFICATION_HUB_CONNECTION_STRING,
            AZ_NOTIFICATION_HUB_NAME 
        } = process.env;

        const client = new NotificationHubsClient(AZ_NOTIFICATION_HUB_CONNECTION_STRING, AZ_NOTIFICATION_HUB_NAME);

        const notification = createBrowserNotification({
            body: 'Hello!' 
        });
        
        let result = await client.sendNotification(notification, {
            deviceHandle: {
                endpoint: "https://fcm.googleapis.com/fcm/send/cC2eDuHLJWc:APA91bHa0Sqjv1YZ0yfPKV9jHhgqcnGtJD0t3o_q8yEK3XzTY2R6niyxbB31HuqQ7Io4qkGE01Rc0063lmn0e160YtNTCv58LBu3D_ej8WldE5EvUH8M--BxBAvUvvKYODm8MyQGw8Sv", 
                auth: "G2plJyrPO41w2EQUHe4FwA==",
                p256dh: "BB7DV1QgL341mSgM8bAuCpjQ3vDRmgFckbSIc6k+4G4fmxcSGjmqYasUWP5YuAnOTpp5pjk9tjtUfscsFIkqgpg="
            }
        });

        console.log(result);
        
    }
});