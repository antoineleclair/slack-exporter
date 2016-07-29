(function(win) {

class Parasite {
  constructor(opts) {
    this.TS = opts.TS;
    this.extensionId = opts.extensionId;
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
    case 'SEND_INIT_DATA':
      this.sendInitData();
      break;
    }
  }

  sendInitData() {
    this.port.postMessage({
      type: 'INIT_DATA',
      data: {
        ims: TS.model.ims,
        user: TS.model.user
      }
    });
  }
}

let Util = {
  initParasite: win => {
    let interval = setInterval(() => {
      if (win.TS !== undefined) {
        clearInterval(interval);
        new Parasite({
          TS: win.TS,
          extensionId: Util.getExtensionIdFromUrl()
        });
      }
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

Util.initParasite(win);

})(window);
