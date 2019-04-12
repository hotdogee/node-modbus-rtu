"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ModbusMaster = void 0;

var _bufferput = _interopRequireDefault(require("bufferput"));

var _bluebird = _interopRequireDefault(require("bluebird"));

var _serialHelper = require("./serial-helper");

var _logger = require("./logger");

var _constants = require("./constants");

var _errors = require("./errors");

var packetUtils = _interopRequireWildcard(require("./packet-utils"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ModbusMaster {
  constructor(serialPort, options) {
    serialPort.on('error', err => {
      console.error(err);
    });
    this._options = Object.assign({}, {
      responseTimeout: _constants.RESPONSE_TIMEOUT,
      queueTimeout: _constants.QUEUE_TIMEOUT
    }, options || {});
    this.logger = new _logger.Logger(this._options);
    this.serial = _serialHelper.SerialHelperFactory.create(serialPort, this._options);
  }
  /**
   * Modbus function read holding registers
   * @param {number} slave
   * @param {number} start
   * @param {number} length
   * @param {number | function} [dataType] value from DATA_TYPES const or callback
   * @returns {Promise<number[]>}
   */


  readHoldingRegisters(slave, start, length, dataType) {
    const packet = this.createFixedPacket(slave, _constants.FUNCTION_CODES.READ_HOLDING_REGISTERS, start, length);
    return this.request(packet).then(buffer => {
      const buf = packetUtils.getDataBuffer(buffer);

      if (typeof dataType === 'function') {
        return dataType(buf);
      }

      return packetUtils.parseFc03Packet(buf, dataType);
    });
  }
  /**
   * Modbus function read input registers
   * @param {number} slave
   * @param {number} start
   * @param {number} length
   * @param {number | function} [dataType] value from DATA_TYPES const or callback
   * @returns {Promise<number[]>}
   */


  readInputRegisters(slave, start, length, dataType) {
    const packet = this.createFixedPacket(slave, _constants.FUNCTION_CODES.READ_INPUT_REGISTERS, start, length);
    return this.request(packet).then(buffer => {
      const buf = packetUtils.getDataBuffer(buffer);

      if (typeof dataType === 'function') {
        return dataType(buf);
      }

      return packetUtils.parseFc03Packet(buf, dataType);
    });
  }
  /**
   *
   * @param {number} slave
   * @param {number} register
   * @param {number} value
   * @param {number} [retryCount]
   */


  writeSingleCoil(slave, coil, value, retryCount) {
    const packet = this.createFixedPacket(slave, _constants.FUNCTION_CODES.WRITE_SINGLE_COIL, coil, value);
    retryCount = retryCount || _constants.DEFAULT_RETRY_COUNT;

    const performRequest = retry => {
      return new _bluebird.default((resolve, reject) => {
        const funcName = 'writeSingleCoil: ';
        const funcId = `Slave ${slave}; Coil: ${coil}; Value: ${value};` + `Retry ${retryCount + 1 - retry} of ${retryCount}`;

        if (retry <= 0) {
          throw new _errors.ModbusRetryLimitExceed(funcId);
        }

        this.logger.info(funcName + 'perform request.' + funcId);
        this.request(packet).then(resolve).catch(err => {
          this.logger.info(funcName + err + funcId);
          return performRequest(--retry).then(resolve).catch(reject);
        });
      });
    };

    return performRequest(retryCount);
  }
  /**
   *
   * @param {number} slave
   * @param {number} register
   * @param {number} value
   * @param {number} [retryCount]
   */


  writeSingleRegister(slave, register, value, retryCount) {
    const packet = this.createFixedPacket(slave, _constants.FUNCTION_CODES.WRITE_SINGLE_REGISTER, register, value);
    retryCount = retryCount || _constants.DEFAULT_RETRY_COUNT;

    const performRequest = retry => {
      return new _bluebird.default((resolve, reject) => {
        const funcName = 'writeSingleRegister: ';
        const funcId = `Slave ${slave}; Register: ${register}; Value: ${value};` + `Retry ${retryCount + 1 - retry} of ${retryCount}`;

        if (retry <= 0) {
          throw new _errors.ModbusRetryLimitExceed(funcId);
        }

        this.logger.info(funcName + 'perform request.' + funcId);
        this.request(packet).then(resolve).catch(err => {
          this.logger.info(funcName + err + funcId);
          return performRequest(--retry).then(resolve).catch(reject);
        });
      });
    };

    return performRequest(retryCount);
  }
  /**
   *
   * @param {number} slave
   * @param {number} start
   * @param {number[]} array
   */


  writeMultipleRegisters(slave, start, array) {
    const packet = this.createVariousPacket(slave, _constants.FUNCTION_CODES.WRITE_MULTIPLE_REGISTERS, start, array);
    return this.request(packet);
  }
  /**
   * Create modbus packet with fixed length
   * @private
   * @param {number} slave
   * @param {number} func
   * @param {number} param
   * @param {number} param2
   * @returns {Buffer}
   */


  createFixedPacket(slave, func, param, param2) {
    return new _bufferput.default().word8be(slave).word8be(func).word16be(param).word16be(param2).buffer();
  }
  /**
   * Create modbus packet with various length
   * @private
   * @param {number} slave
   * @param {number} func
   * @param {number} start
   * @param {number[]} array
   * @returns {Buffer}
   */


  createVariousPacket(slave, func, start, array) {
    const buf = new _bufferput.default().word8be(slave).word8be(func).word16be(start).word16be(array.length).word8be(array.length * 2);
    array.forEach(value => buf.word16be(value));
    return buf.buffer();
  }
  /**
   * @private
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>}
   */


  request(buffer) {
    return this.serial.write(packetUtils.addCrc(buffer)).then(response => {
      if (!packetUtils.checkCrc(response)) {
        throw new _errors.ModbusCrcError();
      }

      return response;
    });
  }

}

exports.ModbusMaster = ModbusMaster;