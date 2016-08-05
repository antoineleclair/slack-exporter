import SlackSpy from './slack-spy';

const scriptUrl = (() => {
  let scripts = document.getElementsByTagName('script');
  return scripts[scripts.length - 1].src;
})();

export function initSlackSpy(win) {
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
    if (win.TS.model.mpims === undefined) {
      return;
    }
    clearInterval(interval);
    new SlackSpy({
      TS: win.TS,
      extensionId: getExtensionIdFromUrl()
    });
  }, 1000);
}

function getExtensionIdFromUrl() {
  let qs = scriptUrl.split('?')[1];
  let extensionId = qs.split('=')[1];
  return extensionId;
}
