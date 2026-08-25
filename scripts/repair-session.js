import { SignalSessionHealer } from '../dist/core/bot/signal-session-healer.js';
import path from 'path';

const authDir = path.resolve(process.cwd(), 'baileys_auth_info');
console.log('Running Signal Session Healer on baileys_auth_info for 91706645020777...');
const repaired = SignalSessionHealer.repairPeerSession(authDir, '91706645020777');
console.log('Session repaired:', repaired);
