
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Define paths
const sourceSvg = path.join('../wp_mobileapp/assets', 'abis_icon_source.svg');
const destPng = path.join('../wp_mobileapp/assets', 'abis_icon.png');

console.log(`Converting ${sourceSvg} to ${destPng}...`);

sharp(sourceSvg)
  .resize(1024, 1024) // Resize to high resolution for app icon
  .png()
  .toFile(destPng)
  .then(info => {
    console.log('Conversion successful:', info);
  })
  .catch(err => {
    console.error('Error during conversion:', err);
  });
