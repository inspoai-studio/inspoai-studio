import dotenv from 'dotenv';

dotenv.config();

// Use Supabase Management API to run raw SQL via pg connection
// We'll use the postgres endpoint directly
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sql = `ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;`;

async function enableRealtime() {
  console.log('Enabling Realtime for live_sessions table...');

  try {
    // Use the Supabase REST query endpoint (available in newer versions)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });

    // Try via pg_dump endpoint or direct SQL
    // Supabase exposes a SQL endpoint at /pg/query for service role
    const sqlResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    const text = await sqlResponse.text();
    console.log('Response status:', sqlResponse.status);
    console.log('Response:', text);

    if (sqlResponse.ok) {
      console.log('[Success] Realtime enabled for live_sessions!');
    } else {
      throw new Error(`HTTP ${sqlResponse.status}: ${text}`);
    }
  } catch (err) {
    console.error('[Error] Could not run SQL automatically:', err.message);
    console.log('\nRun this SQL manually in your Supabase Project Dashboard > SQL Editor:');
    console.log('\n   ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;\n');
  }
}

enableRealtime();
