import { fetchBoxerRecord } from './lib/wikipedia';

async function main() {
  // Test simple weight
  const r1 = await fetchBoxerRecord('Jimmy Barry');
  console.log('Jimmy Barry:', JSON.stringify(r1));
  
  // Test plainlist weight
  const r2 = await fetchBoxerRecord('Floyd Mayweather Jr.');
  console.log('Floyd Mayweather:', JSON.stringify(r2));
  
  // Test another
  const r3 = await fetchBoxerRecord('Naoya Inoue');
  console.log('Naoya Inoue:', JSON.stringify(r3));
}
main().catch(console.error);
