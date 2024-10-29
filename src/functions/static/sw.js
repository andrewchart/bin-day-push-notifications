self.addEventListener('push', (event) => {
    event.waitUntil(self.registration.showNotification('Bin Collection Update', {
        body: 'Your bins are being collected'
    }));
});