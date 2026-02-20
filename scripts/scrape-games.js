const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');

async function scrapeGames() {
  console.log('[1] Scraping crazygames.com...');
  const { data } = await axios.get('https://www.crazygames.com/th/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
    },
    timeout: 20000,
  });

  const $ = cheerio.load(data);
  const games = [];
  const seen = new Set();

  $('a[href*="/game/"]').each((_, el) => {
    if (games.length >= 10) return false;
    const href = $(el).attr('href') || '';
    const slug = href.split('/game/')[1]?.split('/')[0] || '';
    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    // Try multiple selectors for title
    const title = (
      $(el).find('p').first().text().trim() ||
      $(el).find('[class*="title"]').first().text().trim() ||
      $(el).find('[class*="name"]').first().text().trim() ||
      $(el).find('span').first().text().trim() ||
      $(el).attr('title') ||
      $(el).attr('aria-label') ||
      slug.replace(/-/g, ' ')
    ).slice(0, 100);

    const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
    const category = href.includes('action') ? 'Action' :
                     href.includes('puzzle') ? 'Puzzle' :
                     href.includes('racing') ? 'Racing' :
                     href.includes('sport') ? 'Sports' : 'Other';

    games.push({
      title,
      slug,
      url: 'https://www.crazygames.com' + href,
      thumbnail: img.slice(0, 500),
      category,
    });
  });

  console.log(`[2] Found ${games.length} games:`);
  games.forEach((g, i) => console.log(`  ${i + 1}. ${g.title} (${g.slug})`));
  return games;
}

async function setupDatabase(games) {
  console.log('\n[3] Connecting to MySQL...');
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'mcp_hub',
  });

  console.log('[4] Creating table `game`...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS game (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(200) NOT NULL UNIQUE,
      url VARCHAR(500) NOT NULL,
      thumbnail VARCHAR(500),
      category VARCHAR(100) DEFAULT 'Other',
      rating DECIMAL(3,1) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[5] Inserting games...');
  let inserted = 0;
  for (const g of games) {
    try {
      await conn.execute(
        'INSERT IGNORE INTO game (title, slug, url, thumbnail, category) VALUES (?, ?, ?, ?, ?)',
        [g.title, g.slug, g.url, g.thumbnail, g.category]
      );
      inserted++;
    } catch (e) {
      console.warn(`  Skip ${g.slug}: ${e.message}`);
    }
  }

  const [rows] = await conn.execute('SELECT id, title, category FROM game LIMIT 15');
  console.log(`\n[6] Done! Inserted ${inserted} games. Table contents:`);
  console.table(rows);

  await conn.end();
}

(async () => {
  try {
    const games = await scrapeGames();
    if (games.length === 0) {
      console.error('No games found — site may use JS rendering');
      process.exit(1);
    }
    await setupDatabase(games);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
