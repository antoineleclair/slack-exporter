class DropboxWrapper {

  constructor(opts) {
    this.initDropboxClient(opts.appKey);
  }

  initDropboxClient(appKey) {
    this.client = new Dropbox.Client({
      key: appKey
    });
    this.client.authDriver(new Dropbox.AuthDriver.ChromeExtension({
      receiverPath: 'dropbox/oauth-receiver.html'
    }));
    this.client.authenticate((error, data) => {
      if (error) {
        console.log('Error authenticating Dropbox client', error);
        return;
      }
    });
  }

  getIm(teamName, user, im) {
    let path = this._imPath(teamName, user, im);
    return new Promise((resolve, reject) => {
      this.client.readFile(path, (error, data, meta, rangeInfo) => {
        if (error) {
          if (error.status == 404) {
            console.log('Got 404 for "' + path + '", returning empty ims');
            data = this._defaultIm(user, im);
          } else {
            reject(); // some othe error
            return;
          }
        } else {
          data = JSON.parse(data);
        }
        resolve(data);
      });
    });
  }

  addImMsgs(teamName, user, im, messages, hasMore, oldest, latest) {
    let path = this._imPath(teamName, user, im);
    return new Promise((resolve, reject) => {
      this.getIm(teamName, user, im).then(data => {
        let changed = this.mergeIms(data, im, messages);
        if (!hasMore && oldest === undefined) {
          if (!data.gotOldest) {
            changed = true;
          }
          data.gotOldest = true;
        }
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

  _imPath(teamName, user, im) {
    return teamName + '/' + user.name + '/ims/' + im.name + '.json';
  }

  _defaultIm(user, im) {
    return {
      id: im.id,
      users: [{
        id: im.user,
        name: im.name
      }, {
        id: user.id,
        name: user.name
      }],
      gotOldest: false,
      msgs: []
    }
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

export default DropboxWrapper;
