
/* Page Element Definitions */
const subscribeForm = document.getElementById('subscribeForm');
const subscribeBtn = document.getElementById('subscribe');

const unsubscribeForm = document.getElementById('unsubscribeForm');

subscribeForm.onsubmit = subscribe;
unsubscribeForm.onsubmit = unsubscribe;

/* UI Generic Feedback Message */
const userFeedbackMsg = document.getElementById('userFeedbackMsg');

function setMessage(level, msg) {

    var msgClass;

    switch(level) {
        case 'error': 
            msgClass = 'error';
            break;
        case 'warning':
            msgClass = 'warning';
            break;
        case 'ok':
            msgClass = 'ok';
            break;
        default: 
            console.error('Invalid message class');
            return;
    }

    userFeedbackMsg.innerHTML = msg;
    userFeedbackMsg.classList.remove('error','warning','ok');
    userFeedbackMsg.classList.add(msgClass);
    userFeedbackMsg.classList.remove('hidden');
}

function hideMessage() {
    userFeedbackMsg.classList.add('hidden');
}


/* ServiceWorker & Push Subscription Handling */
if("serviceWorker" in navigator) {
    navigator.serviceWorker.register('sw.js');


    navigator.serviceWorker.ready.then((registration) => {
    
        subscribeBtn.removeAttribute('disabled');
    
        return registration.pushManager.getSubscription();
    
    }).then((subscription) => {
    
        if(subscription) {
            loadCurrentSubscriptionAddressDetails();
            unsubscribeForm.classList.remove('hidden');
        } else {
            subscribeForm.classList.remove('hidden');
        }
    
    }).catch((error) =>{
        subscribeForm.classList.remove('hidden');
    });    
} else {
    setMessage('error', `Your browser does not support push notifications. Please try another browser`);
}


function subscribe(event) {

    event.preventDefault();

    Notification.requestPermission().then((permissionStatus) => {
        if(permissionStatus !== 'granted') {
            return setMessage('error', `You have disabled push notifications for this website in your 
                browser. Please grant permission to subscribe to push notifications then try 
                again.`);
        }

        hideMessage();

        navigator.serviceWorker.ready.then(async (registration) => {

            //Spinner state
            subscribeBtn.disabled = true;

            //Fetch Vapid Key
            let url = `${AZ_HTTP_FUNC_BASE_URL}/api/getvapidkey`;
            const vapidServerKey = await fetch(url).then(response => response.text());

            registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidServerKey
            }).then((subscription) => {

                if(subscription) {
                    console.log(subscription);    

                    // TODO: send to server
                    
                    // TODO: store form details locally 

                    setMessage('ok', `Successfully subscribed to push notifications.`);
                    loadCurrentSubscriptionAddressDetails();
                    subscribeForm.classList.add('hidden');
                    subscribeBtn.removeAttribute('disabled');
                    unsubscribeForm.classList.remove('hidden');

                } else {
                    setMessage('error', `Failed to subscribe to push notifications. Please try again`);
                }

            }); 
        });
    });
}


function loadCurrentSubscriptionAddressDetails() {
    document.getElementById('currentSubPropertyNameOrNumber').innerText = '1';
    document.getElementById('currentSubStreet').innerText = 'High Street';
    document.getElementById('currentSubPostcode').innerText = 'GU1 1AB';
}


function unsubscribe(event) {

    event.preventDefault();

    if(!confirm("You will stop receiving push notifications for this address. Are you sure?")) {
        return false;
    }

    navigator.serviceWorker.ready.then((registration) => {
        return registration.pushManager.getSubscription();
    }).then((subscription) => {

        if(!subscription) {
            unsubscribeForm.classList.add('hidden');
            subscribeForm.classList.remove('hidden');
            throw new Error('No push subscription to unsubscribe from.');
        }

        // TODO: remove from database

        subscription.unsubscribe().then((success) => {
            if(success) {
                setMessage('ok', `Successfully unsubscribed from push notifications.`);
                unsubscribeForm.classList.add('hidden');
                subscribeForm.classList.remove('hidden');
            } else {
                throw new Error('Failed to unsubscribe from push notifications. Please try again.');
            }
        });

    }).catch((error) => {
        setMessage('error', error);
    });

}

/* iOS user hint messaging */
function iOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

if(iOS()) {
    document.body.classList.add('ios');
}

/* PWA Add to Home Screen Prompt */
let deferredPrompt; 
 
window.addEventListener('beforeinstallprompt', (e) => { 
    // Prevent the mini-info bar from appearing on mobile 
    e.preventDefault(); 
    // Stash the event so it can be triggered later 
    deferredPrompt = e; 
    // Update UI to notify the user they can add to home screen 
    document.getElementById('addToHomeScreenMsg').style.display = 'block'; 
}); 

document.getElementById('addToHomeScreenMsg').addEventListener('click', () => { 
    // Hide the button 
    document.getElementById('addToHomeScreenMsg').style.display = 'none'; 
    // Show the install prompt 
    deferredPrompt.prompt(); 
    // Wait for the user to respond to the prompt 
    deferredPrompt.userChoice.then((choiceResult) => { 
        if (choiceResult.outcome === 'accepted') { 
            console.log('User accepted the A2HS prompt'); 
        } else { 
            console.log('User dismissed the A2HS prompt'); 
        } 
        deferredPrompt = null; 
    }); 
}); 