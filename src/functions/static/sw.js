self.addEventListener('push', (event) => {

    let msg = event.data.json();

    const { subscriptionRowKey, pushReceivedUrl } = msg.data;

    fetch(pushReceivedUrl, { 
        method: 'patch',
        body: JSON.stringify({ key: subscriptionRowKey })
    }).catch(error => {});

    return event.waitUntil(self.registration.showNotification(msg.title, {
        body: msg.text,
        icon: '192.png'
    }));
    
});