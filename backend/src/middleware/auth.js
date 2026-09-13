import initializeFirebaseAdmin from '../config/firebaseConfig.js';
import UserService from '../services/userService.js';

const admin = initializeFirebaseAdmin();

export const authenticateUser = async (req, res, next) => {
  try {
    // Check if the request has an Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required'
      });
    }
    
    // Extract the token
    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Extract user data from the token
    const { uid, email, name, picture } = decodedToken;
    
    // Find or create user in Supabase
    let user = await UserService.findByUid(uid);
    
    if (!user) {
      // Create a new user if not found in the database
      user = await UserService.createUser({
        uid,
        email,
        displayName: name || email.split('@')[0],
        photoURL: picture || null
      });
      console.log(`New user created: ${email}`);
    }
    
    // Check if quota needs to be reset for a new day
    await UserService.resetQuotaIfNeeded(uid, user);

    // Re-fetch after potential reset
    user = await UserService.findByUid(uid);
    req.user = user;
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('[Error] Authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to check search quota
export const checkSearchQuota = async (req, res, next) => {
  try {
    // Get user from request (set by authenticateUser middleware)
    const user = req.user;
    
    // Check if user has available searches
    if (!user.hasAvailableSearches()) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'You have reached your daily search limit of 10 searches',
        quota: user.getQuotaInfo()
      });
    }
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('[Error] Search quota check error:', error.message);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to check search quota'
    });
  }
};
