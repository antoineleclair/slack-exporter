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
