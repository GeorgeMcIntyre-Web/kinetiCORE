import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import * as fs from 'fs';

async function readDwgFile(filePath: string) {
  try {
    console.log('Loading LibreDWG...');
    // Manually specify the WASM directory for Node.js
    const libredwg = await LibreDwg.create(
      './node_modules/@mlightcad/libredwg-web/wasm/'
    );

    console.log('Reading DWG file:', filePath);
    const fileContent = fs.readFileSync(filePath);

    console.log('Parsing DWG data...');
    const dwg = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG);

    console.log('\n=== DWG File Information ===');

    // Check for errors
    if (dwg.error !== 0 && dwg.error !== undefined) {
      console.warn('⚠️  DWG parsing warning - error code:', dwg.error);
      console.warn('File may be partially readable or use unsupported features.');
    }

    // Convert to DwgDatabase for easier access
    console.log('Converting to DwgDatabase...');
    const db = libredwg.convert(dwg);

    console.log('\n=== Summary ===');
    console.log('Header:', db.header ? 'Present' : 'Missing');
    console.log('Blocks:', db.blocks ? Object.keys(db.blocks).length : 0);
    console.log('Layers:', db.layers ? Object.keys(db.layers).length : 0);
    console.log('Entities:', db.entities ? db.entities.length : 0);

    // Extract key information
    const summary = {
      header: db.header ? {
        version: db.header.version,
        acadVersion: db.header.acadVersion,
        dwgCodePage: db.header.dwgCodePage
      } : null,
      blockCount: db.blocks ? Object.keys(db.blocks).length : 0,
      layerCount: db.layers ? Object.keys(db.layers).length : 0,
      entityCount: db.entities ? db.entities.length : 0,
      entityTypes: db.entities ? [...new Set(db.entities.map(e => e.type))] : []
    };

    console.log('\n=== Details ===');
    console.log(JSON.stringify(summary, null, 2));

    // List layers
    if (db.layers) {
      console.log('\n=== Layers ===');
      for (const [name, layer] of Object.entries(db.layers)) {
        console.log(`  - ${name}`);
      }
    }

    // Save summary to file
    const summaryPath = 'dwg_summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('\n✓ Summary saved to:', summaryPath);

    // Save entities to file with BigInt handling
    if (db.entities && db.entities.length > 0) {
      const entitiesPath = 'dwg_entities.json';
      const entitiesJson = JSON.stringify(db.entities.slice(0, 100), (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2);
      fs.writeFileSync(entitiesPath, entitiesJson);
      console.log(`✓ First 100 entities saved to: ${entitiesPath}`);
    }

    // Free memory
    libredwg.dwg_free(dwg);

    return db;
  } catch (error) {
    console.error('Error reading DWG file:', error);
    throw error;
  }
}

// Read the specific file
const dwgPath = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Layout\\Dash\\OHP-B-01-9X-0001-26MY-V801-PRO-IMPBASE_20250912.dwg';
readDwgFile(dwgPath);
