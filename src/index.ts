#!/usr/bin/env node
import { IrisServer } from './server.js';

const server = new IrisServer({ 
  workingDir: process.env.IRIS_WORKING_DIR || process.cwd() 
});

server.run().catch(console.error);
