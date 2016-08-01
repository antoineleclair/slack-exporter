(function(win) {

class SlackSpy {
  constructor(opts) {
    console.log('Slack Exporter: Initializing');
    this.TS = opts.TS;
    this.extensionId = opts.extensionId;
    this.queue = new ThrottledQueue();
    this.initPort();
  }

  initPort() {
    console.log('Slack Exporter: Opening communication port with extension');
    this.port = chrome.runtime.connect(this.extensionId, {
      name: this.TS.model.team.domain
    });
    this.port.onMessage.addListener(this.onMessage.bind(this));
  }

  onMessage(msg) {
    console.log('Slack Exporter: Received message from extension', msg);
    switch (msg.type) {
    case 'REQUEST_INIT_DATA':
      this.queue.enqueue(() => this.sendInitData());
      break;
    case 'REQUEST_IM_MESSAGES':
      this.queue.enqueue(() => {
        return this.sendImMessages(msg.data.imId, msg.data.oldest,
          msg.data.latest);
      });
      break;
    }
  }

  sendInitData() {
    console.log('Slack Exporter: Sending initial data to extension');
    this.port.postMessage({
      type: 'INIT_DATA',
      data: {
        ims: this.TS.model.ims,
        user: this.TS.model.user
      }
    });
  }

  sendImMessages(imId, oldest, latest) {
    console.log('Slack Exporter: Fetching im messages', imId, oldest, latest);
    let im = this.TS.ims.getImById(imId);
    var args = {
      channel: imId,
      count: 1000,
      inclusive: false
    };
    if (oldest) {
      args.oldest = oldest;
    }
    if (latest) {
      args.latest = latest;
    }
    this.TS.ims.fetchHistory(im, args, (success, result) => {
      if (!success) {
        console.log('Slack Exporter: Failed fetching im history', arguments);
        return;
      }
      let data = {
        im: im,
        messages: result.messages,
        hasMore: result.has_more,
        user: this.TS.model.user,
        requestedRange: {
          oldest: oldest,
          latest: latest
        }
      };
      console.log('Slack Exporter: Sending im messages', data);
      this.port.postMessage({
        type: 'IM_MESSAGES',
        data: data
      });
      if (result.has_more) {
        let newOldest, newLatest;
        if (oldest) {
          // TODO
        } else {
          newLatest = result.messages[result.messages.length - 1].ts;
        }
        this.queue.enqueue(() => {
          return this.sendImMessages(imId, newOldest, newLatest);
        });
      }
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
