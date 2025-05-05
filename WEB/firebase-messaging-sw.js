importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBu7K1CL3UC2Gtd36Snj7bxJoMLD43-J9o",
  authDomain: "pwa-notice.firebaseapp.com",
  projectId: "pwa-notice",
  messagingSenderId: "347013597846",
  appId: "1:347013597846:web:4c20ebcbdc5c7da68010b7",
  measurementId: "G-3B9FBQ2WZ6"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('🌙 收到背景訊息：', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Better-vegetable-catcher/image/png/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
