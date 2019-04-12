import test from './tape'
import sinon from 'sinon'
import { SerialHelper } from '../src/serial-helper'
import { Queue } from '../src/queue'
import { ModbusResponseTimeout } from '../src/errors'
import noop from 'lodash/noop'
import { EventEmitter } from 'events'

const serialPort = Object.assign(new EventEmitter(), {
  write: noop
})

const options = {
  responseTimeout: 50,
  queueTimeout: 0
}

class QueueStub extends Queue {
  push (task) {
    this.taskHandler(task, noop)
  }
}

const samplePayload = Buffer.from('11 03 00 6B 00 03 76 87'.replace(/\s/g, ''), 'hex')

test('Should start the Queue when port opens', (t) => {
  const queue = new Queue(options.queueTimeout)
  queue.start = sinon.spy()

  new SerialHelper(serialPort, queue, options) // eslint-disable-line no-new
  serialPort.emit('open')

  t.ok(queue.start.called, 'Queue start method should be called')
  t.end()
})

test('Should resolve promise with valid message', (t) => {
  t.plan(1)
  const queue = new QueueStub(options.queueTimeout)
  const helper = new SerialHelper(serialPort, queue, options)
  const msg = '11 03 06 AE 41 56 52 43 40 49 AD'.replace(/\s/g, '')

  helper.write(samplePayload).then((response) => {
    t.equal(response.toString('hex').toUpperCase(), msg)
  })

  for (let i = 0; i < msg.length; i += 2) {
    setTimeout(() => {
      serialPort.emit('data', Buffer.from(msg.slice(i, i + 2), 'hex'))
    })
  }
})

test('Should reject promise if timeout exceed', (t) => {
  t.plan(1)

  const clock = sinon.useFakeTimers()
  const queue = new QueueStub(options.queueTimeout)
  const helper = new SerialHelper(serialPort, queue, options)

  helper.write(samplePayload).catch((err) => {
    t.equal(err.constructor, ModbusResponseTimeout, 'Error should be a proper type')
  })

  clock.tick(options.responseTimeout + 10)
  clock.restore()
})
