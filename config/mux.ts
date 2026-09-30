import Mux from '@mux/mux-node';
import dotenv from 'dotenv';
dotenv.config();

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

export const mux = new Mux({
  tokenId: tokenId || '',
  tokenSecret: tokenSecret || '',
});
