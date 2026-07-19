const fs = require('fs');
const axios = require('axios');

// =========================================================================
// CONFIGURATION ENGINE (SECURED VIA GITHUB SECRETS OAUTH)
// =========================================================================
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const CHANNEL_ID = 'UCqRFJN6QZ4t4qf3k7qxEFXA';

const CUSTOM_ORDER_MAP = {
  "trailers": 1,
  "advertisements": 2,
  "hospitality videos": 3,
  "corporate films": 4,
  "documentaries": 5,
  "government campaigns": 6,
  "awareness videos": 7,
  "vertical series": 8,
  "music videos": 9,
  "comic sketches": 10,
  "bts": 11,
  "reels": 12,
  "tutorials & testimonials": 13,
  "pitch videos": 14,
  "theatre plays": 15,
  "voiceovers": 16,
  "motion graphics": 17
};

// Helper function to dynamically grab a fresh Access Token using your Refresh Token
async function getAccessToken() {
  try {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    });
    return res.data.access_token;
  } catch (error) {
    throw new Error("Failed to generate access token from credentials: " + (error.response ? JSON.stringify(error.response.data) : error.message));
  }
}

async function fetchAllYouTubeData() {
  let videoData = {};
  let baseCategories = [];
  let uniquePlaylistNamesFound = [];
  let playlistPageToken = '';

  console.log("Initializing dynamic OAuth YouTube engine synchronization loop...");

  try {
    const accessToken = await getAccessToken();
    const authHeader = { headers: { Authorization: `Bearer ${accessToken}` } };

    do {
      // Swapped public key param to secure authHeader payload to access unlisted collections
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&channelId=${CHANNEL_ID}&maxResults=50&pageToken=${playlistPageToken}`;
      const playlistRes = await axios.get(playlistUrl, authHeader);
      
      if (!playlistRes.data.items || playlistRes.data.items.length === 0) break;

      for (let playlist of playlistRes.data.items) {
        const playlistId = playlist.id;
        const categoryName = playlist.snippet.title;

        if (!uniquePlaylistNamesFound.includes(categoryName)) {
          uniquePlaylistNamesFound.push(categoryName);
        }

        if (!videoData[categoryName]) {
          videoData[categoryName] = [];
          baseCategories.push(categoryName);
        }

        let videoPageToken = '';
        do {
          const videoUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${videoPageToken}`;
          const videoRes = await axios.get(videoUrl, authHeader);

          if (videoRes.data.items) {
            for (let item of videoRes.data.items) {
              const videoName = item.snippet.title;
              const videoId = item.snippet.resourceId.videoId;
              let videoDesc = item.snippet.description ? item.snippet.description.trim() : '';
              videoDesc = videoDesc.replace(/[\r\n]+/g, ' • ');

              const embedUrl = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`;
              let thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

              if (item.snippet.thumbnails && item.snippet.thumbnails.maxres) {
                thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
              } else if (item.snippet.thumbnails && item.snippet.thumbnails.high) {
                thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }

              videoData[categoryName].push({
                name: videoName ? videoName.toString().trim() : "Untitled-Video",
                embedUrl: embedUrl,
                thumb: thumbUrl,
                desc: videoDesc
              });
            }
          }
          videoPageToken = videoRes.data.nextPageToken || '';
        } while (videoPageToken);
      }

      playlistPageToken = playlistRes.data.nextPageToken || '';
    } while (playlistPageToken);

    const sortedCategoriesArray = baseCategories.sort((a, b) => {
      const keyA = a.toString().toLowerCase().trim();
      const keyB = b.toString().toLowerCase().trim();
      const orderA = CUSTOM_ORDER_MAP[keyA] !== undefined ? CUSTOM_ORDER_MAP[keyA] : 9999;
      const orderB = CUSTOM_ORDER_MAP[keyB] !== undefined ? CUSTOM_ORDER_MAP[keyB] : 9999;
      return orderA - orderB;
    });

    const outputData = {
      categories: sortedCategoriesArray,
      videos: videoData
    };

    fs.writeFileSync('data.json', JSON.stringify(outputData, null, 2));
    console.log("Success! Secure synchronization completed cleanly. data.json populated.");

  } catch (error) {
    console.error("Data Sync Pipeline Failed: ", error.message);
  }
}

fetchAllYouTubeData();
