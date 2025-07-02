// server.js
const express = require('express');
const { Actor, HttpAgent } = require('@dfinity/agent');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configure agent to connect to local dfx
const agent = new HttpAgent({ 
  host: 'http://localhost:4943'
});

// In development, disable certificate verification
if (process.env.NODE_ENV !== 'production') {
  agent.fetchRootKey().catch(err => {
    console.warn('Unable to fetch root key. Check to ensure that your local replica is running');
    console.error(err);
  });
}

const canisterId = 'bkyz2-fmaaa-aaaaa-qaaaq-cai'; // Your canister ID

// Import the generated canister interface
let backend;

async function initializeActor() {
  try {
    // Fix the require path - use the correct path to the generated file
    const { idlFactory } = require('./.dfx/local/canisters/backend/backend.did.js');
    
    backend = Actor.createActor(idlFactory, {
      agent,
      canisterId,
    });
    
    console.log('🎯 Connected to backend canister:', canisterId);
  } catch (error) {
    console.error('❌ Failed to initialize actor:', error);
    process.exit(1);
  }
}

// Your HTTP endpoints
app.post('/validate', async (req, res) => {
  try {
    console.log('📨 /validate called with:', req.body);
    
    // Log the validation request to the canister
    const logId = await backend.logValidate(JSON.stringify(req.body));
    
    // Return the response
    res.json({
      message: "You are not registered",
      action: "back",
      logId: Number(logId),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error in /validate:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.post('/mes', async (req, res) => {
  try {
    console.log('📨 /mes called with:', req.body);
    
    // Log the mes request to the canister
    const logId = await backend.logMes(JSON.stringify(req.body));
    
    // Return the response
    res.json({
      message: "You are registered", 
      action: "next",
      logId: Number(logId),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error in /mes:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Additional endpoints to interact with your canister
app.get('/logs', async (req, res) => {
  try {
    const logs = await backend.getLogs();
    res.json(logs);
  } catch (error) {
    console.error('❌ Error fetching logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch logs',
      details: error.message 
    });
  }
});

app.get('/logs/:endpoint', async (req, res) => {
  try {
    const endpoint = `/${req.params.endpoint}`;
    const logs = await backend.getLogsByEndpoint(endpoint);
    res.json(logs);
  } catch (error) {
    console.error('❌ Error fetching logs by endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch logs by endpoint',
      details: error.message 
    });
  }
});

app.get('/count', async (req, res) => {
  try {
    const count = await backend.getCount();
    res.json({ count: Number(count) });
  } catch (error) {
    console.error('❌ Error fetching count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch count',
      details: error.message 
    });
  }
});

app.delete('/logs', async (req, res) => {
  try {
    await backend.clearLogs();
    res.json({ message: 'All logs cleared successfully' });
  } catch (error) {
    console.error('❌ Error clearing logs:', error);
    res.status(500).json({ 
      error: 'Failed to clear logs',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    canisterId: canisterId
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  await initializeActor();
  
  app.listen(PORT, () => {
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('📋 Available endpoints:');
    console.log('   POST /validate - Validate user');
    console.log('   POST /mes - Register user');
    console.log('   GET /logs - Get all logs');
    console.log('   GET /logs/:endpoint - Get logs by endpoint');
    console.log('   GET /count - Get log count');
    console.log('   DELETE /logs - Clear all logs');
    console.log('   GET /health - Health check');
  });
}

startServer().catch(console.error);