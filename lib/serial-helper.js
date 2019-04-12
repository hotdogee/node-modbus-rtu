"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SerialHelper = exports.SerialHelperFactory = void 0;

var _task = require("./task");

var _queue = require("./queue");

var _errors = require("./errors");

var _logger = require("./logger");

class SerialHelperFactory {
  /**
     * @param {SerialPort} serialPort
     * @param options
     * @returns {SerialHelper}
     */
  static create(serialPort, options) {
    const queue = new _queue.Queue(options.queueTimeout);
    return new SerialHelper(serialPort, queue, options);
  }

}

exports.SerialHelperFactory = SerialHelperFactory;

class SerialHelper {
  /**
     * @param {SerialPort} serialPort
     * @param {Queue<Task>} queue
     * @param options
     */
  constructor(serialPort, queue, options) {
    /**
         * @type {Queue<Task>}
         * @private
         */
    this.queue = queue;
    queue.setTaskHandler(this.handleTask.bind(this));
    /**
         * @private
         */

    this.options = options;
    this.serialPort = serialPort;
    this.logger = new _logger.Logger(options);
    this.bindToSerialPort();
  }
  /**
     *
     * @param {Buffer} buffer
     * @returns {Promise}
     */


  write(buffer) {
    const task = new _task.Task(buffer);
    this.queue.push(task);
    return task.promise;
  }
  /**
     * @private
     */


  bindToSerialPort() {
    this.serialPort.on('open', () => {
      this.queue.start();
    });
  }
  /**
     *
     * @param {Task} task
     * @param {function} done
     * @private
     */


  handleTask(task, done) {
    this.logger.info('write ' + task.payload.toString('HEX'));
    this.serialPort.write(task.payload, error => {
      if (error) {
        task.reject(error);
      }
    }); // set execution timeout for task

    setTimeout(() => {
      task.reject(new _errors.ModbusResponseTimeout(this.options.responseTimeout));
    }, this.options.responseTimeout);

    const onData = data => {
      task.receiveData(data, response => {
        this.logger.info('resp ' + response.toString('HEX'));
        task.resolve(response);
      });
    };

    this.serialPort.on('data', onData);
    task.promise.catch(() => {}).finally(() => {
      this.serialPort.removeListener('data', onData);
      done();
    });
  }

}

exports.SerialHelper = SerialHelper;