// Exports an animated contact sheet from the exact atlas pixels (no pose edits).
const fs=require('node:fs'),sharp=require('sharp'),{PNG}=require('pngjs');
const dirs=['South','Southeast','East','Northeast','North','Northwest','West','Southwest'];
async function main(){
  const atlas=PNG.sync.read(fs.readFileSync(process.argv[2]??'src/assets/sprites/ron/ron-atlas.png'));
  const width=768,pageHeight=288*2,frames=8;
  const pages=new PNG({width,height:pageHeight*frames});
  const labels=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="576">${dirs.map((d,i)=>`<text x="${i%4*192+96}" y="${Math.floor(i/4)*288+23}" font-family="Arial" font-size="14" text-anchor="middle" fill="#ecddba">${d}</text>`).join('')}</svg>`)).raw().ensureAlpha().toBuffer();
  for(let f=0;f<frames;f++){
    for(let y=0;y<pageHeight;y++)for(let x=0;x<width;x++){
      const j=(y*width+x)*4,k=((f*pageHeight+y)*width+x)*4;
      const a=labels[j+3]/255;
      [30,47,42].forEach((c,i)=>pages.data[k+i]=Math.round(labels[j+i]*a+c*(1-a)));pages.data[k+3]=255;
    }
    for(let r=0;r<8;r++)for(let y=0;y<256;y++)for(let x=0;x<192;x++){
      const j=((r*256+y)*atlas.width+(f+4)*192+x)*4;
      const k=(((f*pageHeight+Math.floor(r/4)*288+30+y)*width)+(r%4)*192+x)*4;
      const a=atlas.data[j+3]/255;for(let c=0;c<3;c++)pages.data[k+c]=Math.round(atlas.data[j+c]*a+pages.data[k+c]*(1-a));
    }
  }
  await sharp(pages.data,{raw:{width,height:pageHeight*frames,channels:4,pageHeight}}).gif({loop:0,delay:100,effort:7,dither:0}).toFile('docs/ron-animation/walk-preview.gif');
  console.log('Exported eight-frame, 10fps preview.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
