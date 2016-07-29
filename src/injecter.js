let body = document.getElementsByTagName('body')[0];
let script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
let src = chrome.extension.getURL('src/parasite.js') + '?extension_id='
  + chrome.runtime.id;
script.setAttribute('src', src);
body.appendChild(script);
