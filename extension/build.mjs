import { build, context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await copyFile('manifest.json','dist/manifest.json');
const config={entryPoints:['src/content.js'],outfile:'dist/content.js',bundle:true,format:'iife',target:'chrome116',minify:false,logLevel:'info'};
if(process.argv.includes('--watch')) {const ctx=await context(config); await ctx.watch();console.log('Watching extension source...');}
else await build(config);
