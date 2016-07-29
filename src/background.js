var dropboxClient = new Dropbox.Client({
  key: 'lhy2vrl1tsbpefo'
});

dropboxClient.authDriver(new Dropbox.AuthDriver.ChromeExtension({
  receiverPath: 'src/dropbox/oauth-receiver.html'
}));

dropboxClient.authenticate((error, data) => {
  if (error) {
    console.log('Error authenticating', error);
    return;
  }
});

chrome.runtime.onConnectExternal.addListener(function(port) {
  console.log('New connection for team', port.name);
  port.onMessage.addListener(function(msg) {
    console.log('Received message', msg);
  });
});

chrome.webNavigation.onCompleted.addListener(function(details) {
  chrome.tabs.executeScript(details.tabId, {
    file: 'src/injecter.js'
  });
}, {
  url: [{
    hostSuffix: '.slack.com'
  }]
});
