const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = '../../../content_creation_ebook/app/out';
const ASSETS_PATH = path.resolve(__dirname, ASSETS_DIR);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function uploadToKV() {
  console.log('🚀 Uploading frontend assets to Cloudflare KV...');
  
  if (!fs.existsSync(ASSETS_PATH)) {
    console.error('❌ Assets directory not found:', ASSETS_PATH);
    console.log('Please run "npm run build" in the frontend app first.');
    process.exit(1);
  }

  const allFiles = getAllFiles(ASSETS_PATH);
  console.log(`📁 Found ${allFiles.length} files to upload`);

  allFiles.forEach(filePath => {
    const relativePath = path.relative(ASSETS_PATH, filePath);
    const kvKey = relativePath.replace(/\\/g, '/'); // Normalize path separators
    
    try {
      console.log(`⬆️  Uploading: ${kvKey}`);
      
      // Use wrangler to upload each file to KV
      execSync(`npx wrangler kv:key put "${kvKey}" --path="${filePath}" --binding=ASSETS`, {
        stdio: 'pipe',
        cwd: __dirname
      });
      
    } catch (error) {
      console.error(`❌ Failed to upload ${kvKey}:`, error.message);
    }
  });

  console.log('✅ Asset upload complete!');
}

// Run the upload
uploadToKV();
