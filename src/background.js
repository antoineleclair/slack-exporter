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
      this.initDataReceived(port, msg.data);
      break;
    case 'IM_MESSAGES':
      this.receiveImMessages(port, msg.data);
      break;
    }
  }

  requestInitData(port) {
    port.postMessage({
      type: 'REQUEST_INIT_DATA'
    });
  }

  initDataReceived(port, msgData) {
    console.log('Received init data', port.name, msgData);
    msgData.ims.forEach(im => {
      return this.requestImMessages(port, im);
    });
  }

  requestImMessages(port, im) {
    port.postMessage({
      type: 'REQUEST_IM_MESSAGES',
      data: {
        imId: im.id
      }
    })
  }

  receiveImMessages(port, msgData) {
    this.queue.enqueue(() => {
      return this.dropboxWrapper.addImMsgs(port.name, msgData.user, msgData.im,
        msgData.messages)
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

  addImMsgs(teamName, user, im, messages) {
    let path = teamName + '/' + user.name + '/ims/' + im.name + '.json';
    return new Promise((resolve, reject) => {
      this.client.readFile(path, (error, data, meta, rangeInfo) => {
        if (error) {
          if (error.status == 404) {
            data = {
              id: im.id,
              users: [{
                id: im.user,
                name: im.name
              }, {
                id: user.id,
                name: user.name
              }],
              msgs: []
            };
          } else {
            reject(); // some othe error
            return;
          }
        } else {
          data = JSON.parse(data);
        }
        let changed = this.mergeIms(data, im, messages);
        if (changed) {
          this.client.writeFile(path, this.stringify(data), (error) => {
            if (error) {
              reject();
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  mergeIms(data, im, messages) {
    let changed = false;
    messages.forEach(message => {
      var existing = data.msgs.filter(msg => this._isSameMsg(msg, message));
      if (existing.length == 0) {
        data.msgs.push(message);
        changed = true;
      }
    });
    data.msgs.sort((a, b) => a.ts - b.ts);
    return changed;
  }

  _isSameMsg(msgA, msgB) {
    return [
      'text',
      'ts',
      'type',
      'user'
    ].every(prop => msgA[prop] == msgB[prop]);
  }

  stringify(data) {
    return JSON.stringify(data, null, 2);
  }

}

let slackExporter = new SlackExporter({
  dropboxAppKey: 'lhy2vrl1tsbpefo'
});
