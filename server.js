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

// Utility function to mask sensitive data
function maskPin(pin) {
  if (!pin) return 'undefined';
  return '*'.repeat(pin.length);
}

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🕐 [${timestamp}] ${req.method} ${req.path}`);
  console.log(`📝 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  next();
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

const canisterId = 'bkyz2-fmaaa-aaaaa-qaaaq-cai';

// Import the generated canister interface
let backend;

async function initializeActor() {
  try {
    const { idlFactory } = require('./src/declarations/backend/backend.did.js');
    
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

// Simple authentication middleware
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'defi2024'
};

let adminSessions = new Set();
// Track registered users (temporary solution until backend has getAllUsers)
let registeredUsers = new Set();
let userActivities = [];

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  if (!adminSessions.has(token)) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  next();
}

// Add activity logging
function logActivity(type, description, details = {}) {
  const activity = {
    type,
    description,
    details,
    timestamp: Date.now()
  };
  userActivities.unshift(activity);
  // Keep only last 100 activities
  if (userActivities.length > 100) {
    userActivities = userActivities.slice(0, 100);
  }
  console.log(`📋 ACTIVITY LOGGED: ${type} - ${description}`);
}

// Serve static files
app.use(express.static('.', {
  index: 'login.html'
}));

// Admin authentication endpoint
app.post('/admin/login', (req, res) => {
  console.log('\n🔐 ===== ADMIN LOGIN ENDPOINT =====');
  const { username, password } = req.body;
  
  console.log('🔐 LOGIN - Attempt:', username);
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const token = generateToken();
    adminSessions.add(token);
    
    // Expire token after 24 hours
    setTimeout(() => {
      adminSessions.delete(token);
    }, 24 * 60 * 60 * 1000);
    
    console.log('✅ LOGIN - Success for:', username);
    logActivity('Admin Login', `Admin user ${username} logged in`);
    res.json({ token, message: 'Login successful' });
  } else {
    console.log('❌ LOGIN - Failed for:', username);
    res.status(401).json({ message: 'Invalid credentials' });
  }
  console.log('🏁 ===== ADMIN LOGIN ENDPOINT END =====\n');
});

// Admin logout endpoint
app.post('/admin/logout', authenticateAdmin, (req, res) => {
  const token = req.headers.authorization.substring(7);
  adminSessions.delete(token);
  logActivity('Admin Logout', 'Admin user logged out');
  res.json({ message: 'Logged out successfully' });
});

// Admin stats endpoint
app.get('/admin/stats', authenticateAdmin, async (req, res) => {
  console.log('\n📊 ===== ADMIN STATS ENDPOINT =====');
  try {
    // Get stats from registered users
    const userList = Array.from(registeredUsers);
    let totalBalance = 0;
    let totalTransactions = 0;
    let actualRegisteredUsers = 0;
    
    // Fetch details for each known user
    for (const phone of userList) {
      try {
        const userResult = await backend.getUserByPhone(phone);
        if (userResult.length > 0) {
          const user = userResult[0];
          if (user.is_registered) {
            actualRegisteredUsers++;
            totalBalance += Number(user.balance);
            totalTransactions += user.history.length;
          }
        }
      } catch (error) {
        console.error(`Error fetching user ${phone}:`, error);
      }
    }
    
    const stats = {
      totalUsers: userList.length,
      registeredUsers: actualRegisteredUsers,
      totalBalance: totalBalance,
      totalTransactions: totalTransactions,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('📊 STATS - Generated:', JSON.stringify(stats, null, 2));
    res.json(stats);
    
  } catch (error) {
    console.error('💥 STATS - Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
  console.log('🏁 ===== ADMIN STATS ENDPOINT END =====\n');
});

// Admin users endpoint
app.get('/admin/users', authenticateAdmin, async (req, res) => {
  console.log('\n👥 ===== ADMIN USERS ENDPOINT =====');
  try {
    const userList = Array.from(registeredUsers);
    const users = [];
    
    console.log('👥 USERS - Fetching details for', userList.length, 'known users');
    
    // Fetch details for each known user
    for (const phone of userList) {
      try {
        console.log(`🔍 Fetching user details for: ${phone}`);
        const userResult = await backend.getUserByPhone(phone);
        
        if (userResult.length > 0) {
          const user = userResult[0];
          console.log(`📋 User ${phone} found:`, {
            registered: user.is_registered,
            balance: Number(user.balance),
            transactions: user.history.length
          });
          
          users.push({
            phone: user.phone,
            balance: Number(user.balance),
            is_registered: user.is_registered,
            history: user.history,
            pin_masked: user.pin ? '*'.repeat(user.pin.length) : 'Not set'
          });
        } else {
          console.log(`❌ User ${phone} not found in backend`);
          // User might be in registration process
          users.push({
            phone: phone,
            balance: 0,
            is_registered: false,
            history: [],
            pin_masked: 'In registration'
          });
        }
      } catch (error) {
        console.error(`💥 Error fetching user ${phone}:`, error);
      }
    }
    
    console.log('👥 USERS - Returning', users.length, 'users');
    res.json(users);
    
  } catch (error) {
    console.error('💥 USERS - Error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
  console.log('🏁 ===== ADMIN USERS ENDPOINT END =====\n');
});

// Admin activities endpoint
app.get('/admin/activities', authenticateAdmin, async (req, res) => {
  console.log('\n📋 ===== ADMIN ACTIVITIES ENDPOINT =====');
  try {
    console.log('📋 ACTIVITIES - Returning', userActivities.length, 'activities');
    res.json(userActivities.slice(0, 20)); // Return last 20 activities
    
  } catch (error) {
    console.error('💥 ACTIVITIES - Error:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
  console.log('🏁 ===== ADMIN ACTIVITIES ENDPOINT END =====\n');
});

// USSD Endpoints

// 1. VALIDATE - Just return registration status
app.post('/validate', async (req, res) => {
  console.log('\n🔍 ===== VALIDATE ENDPOINT =====');
  try {
    const { props } = req.body;
    const msisdn = props?.session?.msisdn;
    
    console.log('📞 VALIDATE - Processing request');
    console.log('📱 MSISDN extracted:', msisdn);
    console.log('🔧 Props object:', JSON.stringify(props, null, 2));
    
    if (!msisdn) {
      console.log('❌ VALIDATE - No MSISDN provided');
      const response = {
        code: "400",
        message: "Invalid request",
        action: "back"
      };
      console.log('📤 VALIDATE - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    console.log('🔄 VALIDATE - Calling backend.isUserRegistered()...');
    const isRegistered = await backend.isUserRegistered(msisdn);
    console.log('📋 VALIDATE - Backend response:', isRegistered);
    
    // Track this user
    registeredUsers.add(msisdn);
    
    let response;
    if (isRegistered) {
      response = {
        code: "200",
        message: "Welcome to USSD-Defi",
        action: "next"
      };
      console.log('✅ VALIDATE - User is registered');
      logActivity('User Access', `Registered user ${msisdn} accessed system`, { phone: msisdn });
    } else {
      response = {
        code: "404", 
        message: "This Number is not registered"
      };
      console.log('❌ VALIDATE - User not registered');
      logActivity('Unregistered Access', `Unregistered user ${msisdn} attempted access`, { phone: msisdn });
    }
    
    console.log('📤 VALIDATE - Final response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 VALIDATE - Error occurred:', error);
    console.error('📊 VALIDATE - Error stack:', error.stack);
    const errorResponse = {
      code: "500",
      message: "Service error",
      action: "back"
    };
    console.log('📤 VALIDATE - Error response:', JSON.stringify(errorResponse, null, 2));
    res.json(errorResponse);
  }
  console.log('🏁 ===== VALIDATE ENDPOINT END =====\n');
});

// 1. REGISTER STAGE 1 - Store phone number only
app.post('/registerstg1', async (req, res) => {
  console.log('\n📝 ===== REGISTER STAGE 1 ENDPOINT =====');
  try {
    const { props } = req.body;
    const msisdn = props?.session?.msisdn;
    
    console.log('📱 REGISTER STG1 - Processing phone number registration');
    console.log('📱 MSISDN:', msisdn);
    console.log('🔧 Props object:', JSON.stringify(props, null, 2));
    
    if (!msisdn) {
      console.log('❌ REGISTER STG1 - No MSISDN provided');
      const response = {
        code: "400",
        message: "Phone number required",
        action: "back"
      };
      console.log('📤 REGISTER STG1 - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    // Track this user
    registeredUsers.add(msisdn);

    console.log('🔄 REGISTER STG1 - Calling backend.setRegistrationPhone()...');
    console.log('📞 REGISTER STG1 - Setting phone number:', msisdn);
    const result = await backend.setRegistrationPhone(msisdn, msisdn);
    console.log('📋 REGISTER STG1 - Phone registration result:', result);
    
    let response;
    if (result.includes("Phone number saved")) {
      response = {
        message: "Phone number Saved for Registration. Please enter your PIN.",
      };
      console.log('✅ REGISTER STG1 - Phone number saved successfully, proceeding to PIN entry');
      logActivity('Registration Started', `User ${msisdn} started registration process`, { phone: msisdn, stage: 1 });
    } else if (result.includes("already registered")) {
      response = {
        message: "Phone number already registered",
        action: "back"
      };
      console.log('⚠️ REGISTER STG1 - Phone already registered');
      logActivity('Registration Attempt', `User ${msisdn} attempted to register but already exists`, { phone: msisdn });
    } else {
      response = {
        code: "400",
        message: result,
        action: "back"
      };
      console.log('❌ REGISTER STG1 - Phone registration failed:', result);
      logActivity('Registration Failed', `User ${msisdn} registration failed at stage 1: ${result}`, { phone: msisdn, stage: 1 });
    }
    
    console.log('📤 REGISTER STG1 - Final response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 REGISTER STG1 - Error occurred:', error);
    console.error('📊 REGISTER STG1 - Error stack:', error.stack);
    logActivity('Registration Error', `System error during registration stage 1`, { error: error.message });
    const errorResponse = {
      code: "500",
      message: "Service error",
      action: "back"
    };
    console.log('📤 REGISTER STG1 - Error response:', JSON.stringify(errorResponse, null, 2));
    res.json(errorResponse);
  }
  console.log('🏁 ===== REGISTER STAGE 1 ENDPOINT END =====\n');
});

// 2. REGISTER STAGE 2 - Receive and store PIN
app.post('/registerstg2', async (req, res) => {
  console.log('\n🔐 ===== REGISTER STAGE 2 ENDPOINT =====');
  try {
    const { input, props } = req.body;
    const msisdn = props?.session?.msisdn;
    
    // Handle both menu selections and custom input
    const pin = input?.value || input?.key;
    
    console.log('📱 REGISTER STG2 - Processing PIN entry');
    console.log('📱 MSISDN:', msisdn);
    console.log('🔐 PIN received:', maskPin(pin));
    console.log('📦 Input object:', JSON.stringify(input, null, 2));
    console.log('🔧 Props object:', JSON.stringify(props, null, 2));
    console.log('🔍 REGISTER STG2 - Input analysis:');
    console.log('  📝 input.key:', input?.key);
    console.log('  📝 input.value:', input?.value ? maskPin(input.value) : 'undefined');
    console.log('  📝 Final PIN used:', maskPin(pin));
    
    if (!pin) {
      console.log('❌ REGISTER STG2 - No PIN provided');
      const response = {
        code: "400",
        message: "PIN required",
        action: "retry"
      };
      console.log('📤 REGISTER STG2 - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    if (!msisdn) {
      console.log('❌ REGISTER STG2 - No MSISDN in session');
      const response = {
        code: "400",
        message: "Session error. Please restart registration.",
        action: "back"
      };
      console.log('📤 REGISTER STG2 - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    console.log('🔄 REGISTER STG2 - Calling backend.setRegistrationPin()...');
    const pinResult = await backend.setRegistrationPin(msisdn, pin);
    console.log('📋 REGISTER STG2 - PIN registration result:', pinResult);
    
    let response;
    if (pinResult.includes("PIN saved")) {
      response = {
        code: "200",
        message: "PIN accepted. Please confirm your PIN.",
        action: "next"
      };
      console.log('✅ REGISTER STG2 - PIN accepted, proceeding to confirmation');
      logActivity('PIN Set', `User ${msisdn} set PIN successfully`, { phone: msisdn, stage: 2 });
    } else {
      response = {
        code: "400",
        message: pinResult,
        action: "retry"
      };
      console.log('❌ REGISTER STG2 - PIN rejected, allowing retry:', pinResult);
      logActivity('PIN Rejected', `User ${msisdn} PIN rejected: ${pinResult}`, { phone: msisdn, stage: 2 });
    }
    
    console.log('📤 REGISTER STG2 - Final response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 REGISTER STG2 - Error occurred:', error);
    console.error('📊 REGISTER STG2 - Error stack:', error.stack);
    logActivity('Registration Error', `System error during registration stage 2`, { error: error.message });
    const errorResponse = {
      code: "500",
      message: "Service error",
      action: "back"
    };
    console.log('📤 REGISTER STG2 - Error response:', JSON.stringify(errorResponse, null, 2));
    res.json(errorResponse);
  }
  console.log('🏁 ===== REGISTER STAGE 2 ENDPOINT END =====\n');
});

// 3. REGISTER STAGE 3 - Confirm PIN and complete registration
app.post('/registerstg3', async (req, res) => {
  console.log('\n✅ ===== REGISTER STAGE 3 ENDPOINT =====');
  try {
    const { input, props } = req.body;
    const msisdn = props?.session?.msisdn;
    
    // Handle both menu selections and custom input
    const confirmPin = input?.value || input?.key;
    
    console.log('📱 REGISTER STG3 - Processing PIN confirmation');
    console.log('📱 MSISDN:', msisdn);
    console.log('🔐 Confirmation PIN received:', maskPin(confirmPin));
    console.log('📦 Input object:', JSON.stringify(input, null, 2));
    console.log('🔧 Props object:', JSON.stringify(props, null, 2));
    console.log('🔍 REGISTER STG3 - Input analysis:');
    console.log('  📝 input.key:', input?.key);
    console.log('  📝 input.value:', input?.value ? maskPin(input.value) : 'undefined');
    console.log('  📝 Final PIN used:', maskPin(confirmPin));
    
    if (!confirmPin) {
      console.log('❌ REGISTER STG3 - No confirmation PIN provided');
      const response = {
        code: "400",
        message: "PIN confirmation required",
        action: "retry"
      };
      console.log('📤 REGISTER STG3 - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    if (!msisdn) {
      console.log('❌ REGISTER STG3 - No MSISDN in session');
      const response = {
        code: "400",
        message: "Session error. Please restart registration.",
        action: "back"
      };
      console.log('📤 REGISTER STG3 - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }

    console.log('🔄 REGISTER STG3 - Calling backend.confirmRegistrationPin()...');
    const result = await backend.confirmRegistrationPin(msisdn, confirmPin);
    console.log('📋 REGISTER STG3 - Confirmation result:', result);
    
    let response;
    if (result === "Registration successful") {
      response = {
        code: "201", // Created
        message: "Registration completed successfully! Welcome to the service.",
        action: "next"
      };
      console.log('🎉 REGISTER STG3 - Registration completed successfully!');
      console.log('👤 REGISTER STG3 - New user registered:', msisdn);
      console.log('🎊 REGISTER STG3 - User can now use all services');
      logActivity('Registration Complete', `User ${msisdn} completed registration successfully! 🎉`, { phone: msisdn, stage: 3 });
    } else {
      response = {
        code: "400",
        message: result,
        action: "retry"
      };
      console.log('❌ REGISTER STG3 - PIN confirmation failed, allowing retry:', result);
      logActivity('PIN Confirmation Failed', `User ${msisdn} PIN confirmation failed: ${result}`, { phone: msisdn, stage: 3 });
    }
    
    console.log('📤 REGISTER STG3 - Final response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 REGISTER STG3 - Error occurred:', error);
    console.error('📊 REGISTER STG3 - Error stack:', error.stack);
    logActivity('Registration Error', `System error during registration stage 3`, { error: error.message });
    const errorResponse = {
      code: "500",
      message: "Service error",
      action: "back"
    };
    console.log('📤 REGISTER STG3 - Error response:', JSON.stringify(errorResponse, null, 2));
    res.json(errorResponse);
  }
  console.log('🏁 ===== REGISTER STAGE 3 ENDPOINT END =====\n');
});

// 4. TRANSFER - Process transfer request
app.post('/transfer', async (req, res) => {
  console.log('\n💸 ===== TRANSFER ENDPOINT =====');
  try {
    const { input, props } = req.body;
    const msisdn = props?.session?.msisdn;
    
    console.log('💰 TRANSFER - Processing transfer request');
    console.log('📱 Sender MSISDN:', msisdn);
    console.log('📦 Input object:', JSON.stringify(input, null, 2));
    console.log('🔧 Props object:', JSON.stringify(props, null, 2));
    
    // Handle both menu selections and custom input
    const transferInput = input?.value || input?.key;
    
    console.log('🔍 TRANSFER - Input analysis:');
    console.log('  📝 input.key:', input?.key);
    console.log('  📝 input.value:', input?.value);
    console.log('  📝 Final input used:', transferInput);
    
    // Expecting: recipient_phone|amount|pin
    const transferData = transferInput?.split('|');
    console.log('🔧 TRANSFER - Raw transfer data:', transferInput);
    console.log('📊 TRANSFER - Parsed transfer data:', transferData);
    
    if (!transferData || transferData.length !== 3) {
      console.log('❌ TRANSFER - Invalid transfer format');
      console.log('📋 TRANSFER - Expected format: recipient_phone|amount|pin');
      const response = {
        code: "400",
        message: "Invalid transfer format. Use: recipient|amount|pin",
        action: "back"
      };
      console.log('📤 TRANSFER - Response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }
    
    const [recipientPhone, amount, pin] = transferData;
    
    console.log('💸 TRANSFER - Transfer details:');
    console.log('  👤 From:', msisdn);
    console.log('  👤 To:', recipientPhone);
    console.log('  💰 Amount:', amount);
    console.log('  🔐 PIN:', maskPin(pin));
    
    // Track both users
    registeredUsers.add(msisdn);
    registeredUsers.add(recipientPhone);
    
    console.log('🔄 TRANSFER - Calling backend.transfer()...');
    const result = await backend.transfer(msisdn, recipientPhone, parseInt(amount), pin);
    console.log('📋 TRANSFER - Backend result:', result);
    
    let response;
    if (result === "Transfer successful") {
      response = {
        code: "200",
        message: "Transfer completed successfully",
        action: "next"
      };
      console.log('🎉 TRANSFER - Transfer completed successfully!');
      console.log('💸 TRANSFER - Summary: ' + msisdn + ' → ' + recipientPhone + ' (Amount: ' + amount + ')');
      logActivity('Money Transfer', `Transfer successful: ${msisdn} → ${recipientPhone} (${amount} ICP)`, { 
        from: msisdn, 
        to: recipientPhone, 
        amount: parseInt(amount) 
      });
    } else {
      response = {
        code: "400",
        message: result,
        action: "back"
      };
      console.log('❌ TRANSFER - Transfer failed:', result);
      logActivity('Transfer Failed', `Transfer failed: ${msisdn} → ${recipientPhone} - ${result}`, { 
        from: msisdn, 
        to: recipientPhone, 
        amount: parseInt(amount),
        error: result
      });
    }
    
    console.log('📤 TRANSFER - Final response:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 TRANSFER - Error occurred:', error);
    console.error('📊 TRANSFER - Error stack:', error.stack);
    logActivity('Transfer Error', `System error during transfer`, { error: error.message });
    const errorResponse = {
      code: "500",
      message: "Transfer failed",
      action: "back"
    };
    console.log('📤 TRANSFER - Error response:', JSON.stringify(errorResponse, null, 2));
    res.json(errorResponse);
  }
  console.log('🏁 ===== TRANSFER ENDPOINT END =====\n');
});

// HELPER ENDPOINTS FOR TESTING

// Add funds to user account (for testing)
app.post('/addfunds', async (req, res) => {
  console.log('\n💰 ===== ADD FUNDS ENDPOINT =====');
  try {
    const { phone, amount } = req.body;
    console.log('💰 ADD FUNDS - Request details:');
    console.log('  📱 Phone:', phone);
    console.log('  💰 Amount:', amount);
    
    // Track this user
    registeredUsers.add(phone);
    
    console.log('🔄 ADD FUNDS - Calling backend.addFunds()...');
    const result = await backend.addFunds(phone, amount);
    console.log('📋 ADD FUNDS - Result:', result);
    
    logActivity('Funds Added', `Added ${amount} ICP to ${phone}`, { phone, amount });
    
    const response = { message: result };
    console.log('📤 ADD FUNDS - Response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('💥 ADD FUNDS - Error occurred:', error);
    console.error('📊 ADD FUNDS - Error stack:', error.stack);
    logActivity('Add Funds Error', `Failed to add funds to ${phone}`, { error: error.message });
    res.status(500).json({ error: error.message });
  }
  console.log('🏁 ===== ADD FUNDS ENDPOINT END =====\n');
});

// Check balance
app.post('/balance', async (req, res) => {
  console.log('\n📊 ===== BALANCE ENDPOINT =====');
  try {
    const { phone } = req.body;
    console.log('📊 BALANCE - Request details:');
    console.log('  📱 Phone:', phone);
    
    console.log('🔄 BALANCE - Calling backend.getBalance()...');
    const balance = await backend.getBalance(phone);
    console.log('📋 BALANCE - Raw balance:', balance);
    console.log('📋 BALANCE - Converted balance:', Number(balance));
    
    const response = { balance: Number(balance) };
    console.log('📤 BALANCE - Response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('💥 BALANCE - Error occurred:', error);
    console.error('📊 BALANCE - Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
  console.log('🏁 ===== BALANCE ENDPOINT END =====\n');
});

// Health check
app.get('/health', (req, res) => {
  console.log('\n💚 ===== HEALTH CHECK ENDPOINT =====');
  const response = { 
    status: 'ok', 
    timestamp: Date.now(),
    canisterId: canisterId
  };
  console.log('💚 HEALTH - Response:', JSON.stringify(response, null, 2));
  res.json(response);
  console.log('🏁 ===== HEALTH CHECK ENDPOINT END =====\n');
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  await initializeActor();
  
  app.listen(PORT, () => {
    console.log('🚀 USSD Gateway Server running on http://localhost:' + PORT);
    console.log('🔐 Admin Panel: http://localhost:' + PORT + '/login.html');
    console.log('📊 Dashboard: http://localhost:' + PORT + '/dashboard.html');
    console.log('');
    console.log('📋 USSD Flow Endpoints:');
    console.log('   POST /validate - Check registration status');
    console.log('   POST /registerstg1 - Store phone number');
    console.log('   POST /registerstg2 - Set PIN');
    console.log('   POST /registerstg3 - Confirm PIN & complete registration');
    console.log('   POST /transfer - Transfer money');
    console.log('📋 Admin Endpoints:');
    console.log('   POST /admin/login - Admin authentication');
    console.log('   GET /admin/stats - System statistics');
    console.log('   GET /admin/users - All registered users');
    console.log('   GET /admin/activities - Recent activities');
    console.log('📋 Helper Endpoints:');
    console.log('   POST /addfunds - Add funds (testing)');
    console.log('   POST /balance - Check balance');
    console.log('   GET /health - Health check');
    console.log('');
    console.log('📝 Registration Flow:');
    console.log('   1️⃣ /registerstg1 - Registers phone number');
    console.log('   2️⃣ /registerstg2 - User enters PIN');
    console.log('   3️⃣ /registerstg3 - User confirms PIN, registration complete');
    console.log('');
    console.log('🔐 Admin Credentials:');
    console.log('   Username: admin');
    console.log('   Password: defi2024');
  });
}

startServer().catch(console.error);