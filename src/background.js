class SlackExporter {

  constructor(opts) {
    this.opts = opts;
    this.queue = new Queue();
    this.dropboxWrapper = new DropboxWrapper({
      appKey: opts.dropboxAppKey
    });
    this.registerInjecter();
    this.listenForParasites();
  }


  registerInjecter() {
    chrome.webNavigation.onCompleted.addListener(function(details) {
      chrome.tabs.executeScript(details.tabId, {
        file: 'src/injecter.js'
      });
    }, {
      url: [{
        hostSuffix: '.slack.com'
      }]
    });
  }

  listenForParasites() {
    chrome.runtime.onConnectExternal.addListener(port => {
      console.log('New connection for team', port.name);
      port.onMessage.addListener(msg => this.messageReceived(port, msg));
      if (this.dropboxWrapper.client.isAuthenticated()) {
        this.requestInitData(port);
      }
    });
  }

  messageReceived(port, msg) {
    console.log('Received message', msg, 'from port', port);
    switch(msg.type) {
    case 'INIT_DATA':
      this.initDataReceived(port.name, msg.data);
      break;
    }
  }

  requestInitData(port) {
    port.postMessage({
      type: 'SEND_INIT_DATA'
    });
  }

  initDataReceived(teamName, msgData) {
    console.log('Received init data', teamName, msgData);
    this.queue.enqueue(() => {
      let username = msgData.user.name;
      this.dropboxWrapper.ensureAccountDirectoryExists(teamName, username);
    });
  }
}

class Queue {
  enqueue(func) {
    func(); // TODO enqueue and execute in sequence
  }
}

class DropboxWrapper {
  constructor(opts) {
    this.initDropboxClient(opts.appKey);
  }

  initDropboxClient(appKey) {
    this.client = new Dropbox.Client({
      key: appKey
    });
    this.client.authDriver(new Dropbox.AuthDriver.ChromeExtension({
      receiverPath: 'src/dropbox/oauth-receiver.html'
    }));
    this.client.authenticate((error, data) => {
      if (error) {
        console.log('Error authenticating Dropbox client', error);
        return;
      }
    });
  }

  ensureAccountDirectoryExists(teamName, userName) {
    this._ensureDirectoryExists('/', teamName).then(() => {
      return this._ensureDirectoryExists('/', teamName + '/' + userName);
    });
  }

  _ensureDirectoryExists(path, directory) {
    return new Promise((resolve, reject) => {
      this.client.readdir('/', (error, entries) => {
        if (error) {
          console.log('Error reading Dropbox app directory', error);
          reject();
        }
        if (entries.some(entry => entry == directory)) {
          resolve();
        } else {
          this.client.mkdir(directory, resolve);
        }
      });
    });
  }

}

let slackExporter = new SlackExporter({
  dropboxAppKey: 'lhy2vrl1tsbpefo'
});
