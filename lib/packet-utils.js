"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDataBuffer = getDataBuffer;
exports.parseFc03Packet = parseFc03Packet;
exports.addCrc = addCrc;
exports.checkCrc = checkCrc;
exports.DATA_TYPES = void 0;

var _crc = _interopRequireDefault(require("crc"));

var _bufferput = _interopRequireDefault(require("bufferput"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DATA_TYPES = {
  INT: 1,
  UINT: 2,
  ASCII: 3
  /**
   * Slice header, bytes count and crc. Return buffer only with data
   * @param {Buffer} buffer
   */

};
exports.DATA_TYPES = DATA_TYPES;

function getDataBuffer(buffer) {
  return buffer.slice(3, buffer.length - 2);
}
/**
 * Parse function 03 response packet (read holding registers)
 * @param {Buffer} buffer
 * @param {number} [dataType]
 * @returns {number[]}
 */


function parseFc03Packet(buffer, dataType) {
  const results = [];

  for (let i = 0; i < buffer.length; i += 2) {
    results.push(readDataFromBuffer(buffer, i, dataType));
  }

  return results;
}
/**
 * Returns new buffer signed with CRC
 * @param {Buffer} buf
 * @returns {Buffer}
 */


function addCrc(buf) {
  return new _bufferput.default().put(buf).word16le(_crc.default.crc16modbus(buf)).buffer();
}
/**
 *
 * @param {Buffer} buffer
 * @returns boolean
 */


function checkCrc(buffer) {
  const pdu = buffer.slice(0, buffer.length - 2);
  return buffer.equals(this.addCrc(pdu));
}
/**
 *
 * @param {Buffer} buffer
 * @param {int} offset
 * @param {int} [dataType]
 * @returns {number | string}
 */


function readDataFromBuffer(buffer, offset, dataType) {
  switch (dataType) {
    case DATA_TYPES.UINT:
      return buffer.readUInt16BE(offset);

    case DATA_TYPES.ASCII:
      return buffer.toString('ascii', offset, offset + 2);

    default:
      return buffer.readInt16BE(offset);
  }
}