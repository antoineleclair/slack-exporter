(function(win) {

class SlackSpy {
  constructor(opts) {
    this.TS = opts.TS;
    this.extensionId = opts.extensionId;
    this.queue = new ThrottledQueue();
    this.initPort();
  }

  initPort() {
    this.port = chrome.runtime.connect(this.extensionId, {
      name: this.TS.model.team.domain
    });
    this.port.onMessage.addListener(this.onMessage.bind(this));
  }

  onMessage(msg) {
    switch (msg.type) {
    case 'REQUEST_INIT_DATA':
      this.sendInitData();
      break;
    case 'REQUEST_IM_MESSAGES':
      this.queue.enqueue(() => this.sendImMessages(msg.data.imId));
      break;
    }
  }

  sendInitData() {
    this.port.postMessage({
      type: 'INIT_DATA',
      data: {
        ims: this.TS.model.ims,
        user: this.TS.model.user
      }
    });
  }

  sendImMessages(imId) {
    let im = this.TS.ims.getImById(imId);
    this.TS.ims.fetchHistory(im, {
      channel: imId,
      count: 100,
      inclusive: true
    }, (success, result) => {
      if (!success) {
        console.log('Not success fetching IM history', arguments);
        return;
      }
      this.port.postMessage({
        type: 'IM_MESSAGES',
        data: {
          im: im,
          messages: result.messages,
          hasMore: result.has_more,
          user: this.TS.model.user
        }
      });
    });
    im.history_is_being_fetched = false;
  }
}

let Util = {
  initSlackSpy: win => {
    let interval = setInterval(() => {
      if (win.TS === undefined) {
        return;
      }
      if (win.TS.model === undefined) {
        return;
      }
      if (win.TS.model.user === undefined) {
        return;
      }
      if (win.TS.model.ims === undefined) {
        return;
      }
      clearInterval(interval);
      new SlackSpy({
        TS: win.TS,
        extensionId: Util.getExtensionIdFromUrl()
      });
    }, 1000);
  },
  getExtensionIdFromUrl: () => {
    let qs = Util.scriptUrl.split('?')[1];
    let extensionId = qs.split('=')[1];
    return extensionId;
  },
  scriptUrl: (() => {
    let scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1].src;
  })()
}

class ThrottledQueue { // TODO reuse code for background.js
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
    // TODO if _reallyDequeue happened less than 3 seconds ago
    //      setTImeout here instead (remove the one in _funcCallCompleted);
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

Util.initSlackSpy(win);

})(window);
