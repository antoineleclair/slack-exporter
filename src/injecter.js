let script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
let src = chrome.extension.getURL('src/parasite.js') + '?extension_id='
  + chrome.runtime.id;
script.setAttribute('src', src);
document.body.appendChild(script);
