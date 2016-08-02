class Queue {

  constructor(opts = {}) {
    this._queue = [];
    this.length = 0;
    if (opts.throttle) {
      this.throttle = opts.throttle;
      this.lastDequeueTs = new Date().getTime() - this.throttle;
    }
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
    let msWaitRemaining = this.throttle > 0
      ? this.lastDequeueTs + this.throttle - new Date().getTime()
      : 0;
    msWaitRemaining = Math.max(0, msWaitRemaining);
    setTimeout(() => {
      let dequeued = this._queue.shift();
      let promise = dequeued();
      if (promise !== undefined && promise.then !== undefined) {
        promise.then(() => this._funcCallCompleted(),
        () => this._funcCallCompleted());
      } else {
        this._funcCallCompleted();
      }
    }, msWaitRemaining);
  }

  _funcCallCompleted() {
    this.lastDequeueTs = new Date().getTime();
    this._shouldDequeue--;
    this.length--;
    if (this._shouldDequeue > 0) {
      this._reallyDequeue();
    }
  }

}

export default Queue;
