import fetch from 'node-fetch';

async function discoverSavee() {
  const GQL_URL = 'https://savee.com/api/graphql/';

  const query = `
    query GetFeedItems {
      feedItems {
        items {
          _id
          __typename
        }
      }
    }
  `;

  console.log("Attempting Savee.com GraphQL Discovery (IDs only)...");

  try {
    const response = await fetch(GQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://savee.com/pop/',
        'Origin': 'https://savee.com'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors) {
      console.error("[Error] GraphQL Errors:", data.errors[0].message);
    } else if (data.data && data.data.feedItems && data.data.feedItems.items) {
      console.log(`[Success] Successfully found ${data.data.feedItems.items.length} items.`);
      const first = data.data.feedItems.items[0];
      console.log(`\nSample Item:`);
      console.log(`- ID (_id): ${first._id}`);
      console.log(`- Typename: ${first.__typename}`);
    } else {
      console.log(" Data response structure:", JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error("[Error] Discovery Failed:", err.message);
  }
}

discoverSavee();
