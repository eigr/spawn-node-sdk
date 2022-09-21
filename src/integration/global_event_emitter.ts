import { EventEmitter } from 'node:events';

class GlobalEmitter extends EventEmitter {}

const emmiter = new GlobalEmitter();
emmiter.setMaxListeners(Infinity);

export default emmiter;
