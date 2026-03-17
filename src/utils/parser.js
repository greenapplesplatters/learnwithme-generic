import fs from 'fs';
import path from 'path';

// This script will run at build time (or when manually triggered)
// to convert the Obsidian mental models into a static JSON feed.
const parseMentalModels = () => {
  const currentDir = import.meta.dirname;
  const filePath = path.join(currentDir, '../../../lessons/mental_models.md');
  const outputPath = path.join(currentDir, '../data/feed.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    fs.writeFileSync(outputPath, JSON.stringify([]));
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const feed = [];
  let currentTopic = 'General';

  lines.forEach(line => {
    // Detect Topic Header (e.g. "## ☁️ CloudFront & S3")
    if (line.startsWith('## ')) {
      currentTopic = line.replace('## ', '').trim();
    } 
    // Detect Trigger Rules (e.g. "- **Trigger**: \"XYZ\" -> **ABC**")
    else if (line.startsWith('- **Trigger**:')) {
      const match = line.match(/- \*\*Trigger\*\*: "(.*?)" → (\*\*.*?\*\*)/);
      if (match) {
        feed.push({
          type: 'trigger',
          topic: currentTopic,
          content: match[1],
          answer: match[2]
        });
      }
    } 
    // Detect standard rules/models
    else if (line.startsWith('- **') && !line.includes('**Trigger**:')) {
      const content = line.replace('- ', '').trim();
      feed.push({
        type: 'rule',
        topic: currentTopic,
        content: content
      });
    }
  });

  // Randomize the feed so it feels fresh every time
  const shuffled = feed.sort(() => 0.5 - Math.random());

  fs.writeFileSync(outputPath, JSON.stringify(shuffled, null, 2));
  console.log(`✅ Parsed ${shuffled.length} cards into feed.json`);
};

parseMentalModels();
