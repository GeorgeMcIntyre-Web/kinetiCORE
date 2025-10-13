// Test MJCF parsing
console.log('Testing MJCF parsing...');

// Simple test XML
const testXML = `
<mujoco model="test">
  <worldbody>
    <body name="base" pos="0 0 0">
      <geom name="box" type="box" size="0.1 0.1 0.1"/>
    </body>
  </worldbody>
</mujoco>
`;

// Test parsing
const parser = new DOMParser();
const doc = parser.parseFromString(testXML, 'text/xml');
console.log('Parsed XML:', doc);
console.log('Root element:', doc.documentElement);
console.log('Model name:', doc.documentElement.getAttribute('model'));
