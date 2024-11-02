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

        let collections = [
            '♻️ Recycling Bin',
            '🪫 Electrical & Textiles',
            '🥗 Food Bin'
        ];

        const notification = createBrowserNotification({
            body: { 
                title: "Collections tomorrow (3rd Nov)",
                text: collections.join('\n')
            } 
        });
        
        let result = await client.sendNotification(notification, {
            deviceHandle: {
                endpoint: "https://web.push.apple.com/QI3rZCJRINq2IG7gCW_qk9CIpQ0EVyO3QC0zU6IYcGX8Qnd8-ivRZY5dLUn78bnguLQk9oPobSbkVW8K95dnxWOyOa0G-qnwC0_fThVqIDrDPTnAVgihRJ3yG31hunte_CgNrHRQh6IcLSxcusDXos98JHK6DI37tmfBQuFgQ9Y", 
                auth: "C6SO4qZC8nP7Lpvuk44TIg==",
                p256dh: "BD0sRqmgxVOHPUx0ablaNF2bA1CeqCOjZNWbe4cC/ibnRUU2oA/BXLFOCbmeZbPbKcJKoTLgzxiyX7mLox2Cq3E="
            }
        });

        console.log(result);
        
    }
});