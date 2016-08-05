import Queue from '../queue';
import DropboxWrapper from './dropbox-wrapper';

class SlackExporter {

  constructor(opts) {
    console.log('Initializing SlackExporter');
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
        file: 'injector.js'
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
    case 'MPIM_MESSAGES':
      this.receiveMpimMessages(port, msg.data);
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
      return this.requestMissingImMessages(port, msgData.user, im);
    });
    msgData.mpims.forEach(mpim => {
      return this.requestMissingMpimMessages(port, msgData.user, mpim);
    });
  }

  requestMissingImMessages(port, user, im) {
    this.dropboxWrapper.getIm(port.name, user, im).then(data => {
      if (data.msgs.length > 0) {
        if (!data.gotOldest) {
          console.log('Requesting older history for im with "' + im.name
            + '"');
          port.postMessage({
            type: 'REQUEST_IM_MESSAGES',
            data: {
              imId: im.id,
              latest: data.msgs[0].ts
            }
          });
        }
        console.log('Requesting new messages for im with "' + im.name + '"');
        port.postMessage({
          type: 'REQUEST_IM_MESSAGES',
          data: {
            imId: im.id,
            oldest: data.msgs[data.msgs.length - 1].ts
          }
        });
      } else {
        console.log('Requesting all messages for im with "' + im.name + '"');
        port.postMessage({
          type: 'REQUEST_IM_MESSAGES',
          data: {
            imId: im.id
          }
        });
      }
    });
  }

  receiveImMessages(port, msgData) {
    this.queue.enqueue(() => {
      return this.dropboxWrapper.addImMsgs(port.name, msgData.user, msgData.im,
        msgData.messages, msgData.hasMore, msgData.requestedRange.oldest,
        msgData.requestedRange.latest);
    });
  }

  requestMissingMpimMessages(port, user, mpim) {
    this.dropboxWrapper.getMpim(port.name, user, mpim).then(data => {
      if (data.msgs.length > 0) {
        if (!data.gotOldest) {
          console.log('Requesting older history for mpim "' + mpim.id + '"');
          port.postMessage({
            type: 'REQUEST_MPIM_MESSAGES',
            data: {
              mpimId: mpim.id,
              latest: data.msgs[0].ts
            }
          });
        }
        console.log('Requesting new messages for mpim "' + mpim.id + '"');
        port.postMessage({
          type: 'REQUEST_MPIM_MESSAGES',
          data: {
            mpimId: mpim.id,
            oldest: data.msgs[data.msgs.length - 1].ts
          }
        });
      } else {
        console.log('Requesting all messages for mpim "' + mpim.id + '"');
        port.postMessage({
          type: 'REQUEST_MPIM_MESSAGES',
          data: {
            mpimId: mpim.id
          }
        });
      }
    });
  }

  receiveMpimMessages(port, msgData) {
    this.queue.enqueue(() => {
      return this.dropboxWrapper.addMpimMsgs(port.name, msgData.user,
        msgData.mpim, msgData.members, msgData.messages, msgData.hasMore,
        msgData.requestedRange.oldest, msgData.requestedRange.latest);
    });
  }
}

export default SlackExporter;
