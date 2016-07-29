class SlackExporter {

  constructor(opts) {
    this.opts = opts;
    this.queue = new Queue();
    this.dropboxWrapper = new DropboxWrapper({
      appKey: opts.dropboxAppKey
    });
    this.registerInjector();
    this.listenForSpies();
  }


  registerInjector() {
    chrome.webNavigation.onCompleted.addListener(function(details) {
      chrome.tabs.executeScript(details.tabId, {
        file: 'src/injector.js'
      });
    }, {
      url: [{
        hostSuffix: '.slack.com'
      }]
    });
  }

  listenForSpies() {
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
    let username = msgData.user.name;
    msgData.ims.forEach(im => {
      this.queue.enqueue(() => {
        return this.dropboxWrapper.ensureImExists(teamName, username, im);
      });
    });
  }
}


class Queue {
  constructor() {
    this._queue = [];
    this.length = 0;
    this._shouldDequeue = 0;
  }

  enqueue(func) {
    this._queue.push(func);
    this.length++;
    this.dequeue();
  }

  dequeue() {
    if (this._shouldDequeue == this.length) {
      return;
    }
    this._shouldDequeue++;
    if (this._shouldDequeue == 1) {
      this._reallyDequeue();
    }
  }

  _reallyDequeue() {
    let dequeued = this._queue.shift();
    let promise = dequeued();
    if (promise !== undefined && promise.then !== undefined) {
      promise.then(() => this._funcCallCompleted(),
        () => this._funcCallCompleted());
    } else {
      this._funcCallCompleted();
    }
  }

  _funcCallCompleted() {
    this._shouldDequeue--;
    this.length--;
    if (this._shouldDequeue > 0) {
      this._reallyDequeue();
    }
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

  ensureImExists(teamName, userName, im) {
    return new Promise((resolve, reject) => {
      let path = teamName + '/' + userName + '/ims/' + im.name
        + '.json';
      this.client.readFile(path, (error, data, meta, rangeInfo) => {
        if (error) {
          if (error.status == 404) {
            this._createIm(teamName, userName, im).then(resolve, reject);
          } else {
            reject(); // some othe error
          }
        } else {
          resolve();
        }
      });
    });
  }

  _createIm(teamName, userName, im) {
    return new Promise((resolve, reject) => {
      let path = teamName + '/' + userName + '/ims/' + im.name + '.json';
      console.log('Creating IM', path);
      let emptyData = {
        id: im.id,
        user: {
          id: im.user,
          name: im.name
        },
        msgs: []
      };
      let str = JSON.stringify(emptyData, null, 2);
      this.client.writeFile(path, str, (error) => {
        if (error) {
          reject();
        } else {
          resolve();
        }
      });
    });
  }

}

let slackExporter = new SlackExporter({
  dropboxAppKey: 'lhy2vrl1tsbpefo'
});
