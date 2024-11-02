self.addEventListener('push', (event) => {

    let msg = event.data.json();

    event.waitUntil(self.registration.showNotification(msg.title, {
        body: msg.text,
        icon: '192.png'
    }));
});