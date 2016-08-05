import Queue from '../queue';

class SlackSpy {
  constructor(opts) {
    console.log('Slack Exporter: Initializing');
    this.TS = opts.TS;
    this.extensionId = opts.extensionId;
    this.cache = {
      ims: {},
      mpims: {}
    };
    this.queue = new Queue({
      throttle: 3000
    });
    this.initPort();
    this.pollForChanges();
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
    case 'REQUEST_MPIM_MESSAGES':
      this.queue.enqueue(() => {
        return this.sendMpimMessages(msg.data.mpimId, msg.data.oldest,
          msg.data.latest);
      });
      break;
    }
  }

  sendInitData() {
    console.log('Slack Exporter: Sending initial data to extension');
    this.TS.model.ims.forEach(im => this.updateImCache(im, im.msgs));
    this.port.postMessage({
      type: 'INIT_DATA',
      data: {
        user: this.TS.model.user,
        ims: this.TS.model.ims,
        mpims: this.TS.model.mpims
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
      this.updateImCache(im, result.messages);
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

  updateImCache(imId, msgs) {
    if (this.cache.ims[imId] === undefined) {
      this.cache.ims[imId] = {};
    }
    let cache = this.cache.ims[imId];
    if (msgs.length > 0) {
      if (cache.latest === undefined) {
        cache.latest = msgs[0].ts;
      }
      if (cache.oldest === undefined) {
        cache.oldest = msgs[0].ts;
      }
      cache.oldest = Math.min(cache.oldest, msgs[0].ts);
      cache.oldest = Math.min(cache.oldest, msgs[msgs.length - 1].ts);
      cache.latest = Math.max(cache.latest, msgs[0].ts);
      cache.latest = Math.max(cache.latest, msgs[msgs.length - 1].ts);
    }
  }

  shouldSendImMsg(imId, ts) {
    if (this.cache.ims[imId] === undefined) {
      return true;
    }
    if (ts > this.cache.ims[imId].latest) {
      return true;
    }
    if (ts < this.cache.ims[imId].oldest) {
      return true;
    }
    return false;
  }

  sendMpimMessages(mpimId, oldest, latest) {
    console.log('Slack Exporter: Fetching mpim messages', mpimId, oldest,
      latest);
    let mpim = this.TS.mpims.getMpimById(mpimId);
    var args = {
      channel: mpimId,
      count: 1000,
      inclusive: false
    };
    if (oldest) {
      args.oldest = oldest;
    }
    if (latest) {
      args.latest = latest;
    }
    this.TS.mpims.fetchHistory(mpim, args, (success, result) => {
      if (!success) {
        console.log('Slack Exporter: Failed fetching mpim history', arguments);
        return;
      }
      this.updateMpimCache(mpim, result.messages);
      let members = mpim.members.map(memberId => {
        return this.TS.members.getMemberById(memberId);
      });
      let data = {
        mpim: mpim,
        members: members,
        messages: result.messages,
        hasMore: result.has_more,
        user: this.TS.model.user,
        requestedRange: {
          oldest: oldest,
          latest: latest
        }
      };
      console.log('Slack Exporter: Sending mpim messages', data);
      this.port.postMessage({
        type: 'MPIM_MESSAGES',
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
          return this.sendMpimMessages(mpimId, newOldest, newLatest);
        });
      }
    });
    mpim.history_is_being_fetched = false;
  }

  updateMpimCache(mpimId, msgs) {
    if (this.cache.mpims[mpimId] === undefined) {
      this.cache.mpims[mpimId] = {};
    }
    let cache = this.cache.mpims[mpimId];
    if (msgs.length > 0) {
      if (cache.latest === undefined) {
        cache.latest = msgs[0].ts;
      }
      if (cache.oldest === undefined) {
        cache.oldest = msgs[0].ts;
      }
      cache.oldest = Math.min(cache.oldest, msgs[0].ts);
      cache.oldest = Math.min(cache.oldest, msgs[msgs.length - 1].ts);
      cache.latest = Math.max(cache.latest, msgs[0].ts);
      cache.latest = Math.max(cache.latest, msgs[msgs.length - 1].ts);
    }
  }

  shouldSendMpimMsg(mpimId, ts) {
    if (this.cache.mpims[mpimId] === undefined) {
      return true;
    }
    if (ts > this.cache.mpims[mpimId].latest) {
      return true;
    }
    if (ts < this.cache.mpims[mpimId].oldest) {
      return true;
    }
    return false;
  }

  pollForChanges() {
    setTimeout(() => this.pollForChanges(), 5000);
    this.TS.model.ims.forEach(im => {
      let newMsgs = [];
      for (var i = 0, len = im.msgs.length; i < len; i++) {
        if (!this.shouldSendImMsg(im.id, im.msgs[i].ts)) {
          break;
        }
        newMsgs.push(im.msgs[i]);
      }
      if (newMsgs.length > 0) {
        let data = {
          im: im,
          messages: newMsgs,
          hasMore: false,
          user: this.TS.model.user,
          requestedRange: {}
        };
        console.log('Slack Exporter: Sending im messages', data);
        this.port.postMessage({
          type: 'IM_MESSAGES',
          data: data
        });
      }
    });
    this.TS.model.mpims.forEach(mpim => {
      let newMsgs = [];
      for (var i = 0, len = mpim.msgs.length; i < len; i++) {
        if (!this.shouldSendMpimMsg(mpim.id, mpim.msgs[i].ts)) {
          break;
        }
        newMsgs.push(mpim.msgs[i]);
      }
      if (newMsgs.length > 0) {
        let members = mpim.members.map(memberId => {
          return this.TS.members.getMembeById(memberId);
        });
        let data = {
          mpim: mpim,
          members: members,
          messages: result.messages,
          hasMore: result.has_more,
          user: this.TS.model.user,
          requestedRange: {}
        };
        console.log('Slack Exporter: Sending mpim messages', data);
        this.port.postMessage({
          type: 'MPIM_MESSAGES',
          data: data
        });
      }
    });
  }
}

export default SlackSpy;
