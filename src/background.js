chrome.webNavigation.onCompleted.addListener(function(details) {
  chrome.tabs.executeScript(details.tabId, {
    file: 'src/injecter.js'
  });
}, {
  url: [{
    hostSuffix: '.slack.com'
  }]
});
