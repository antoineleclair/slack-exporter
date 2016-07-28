var body = document.getElementsByTagName('body')[0];
var script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.setAttribute('src', chrome.extension.getURL('/src/parasite.js'));
body.appendChild(script);
