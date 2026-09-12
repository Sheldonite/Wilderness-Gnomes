// Packs image-editor walk revisions; never changes the existing idle pixels.
// NODE_PATH must include sharp and pngjs. Run with a manifest path and output path.
const fs=require('node:fs'),path=require('node:path');
const sharp=require('sharp'),{PNG}=require('pngjs');
const dirs=['south','southeast','east','northeast','north','northwest','west','southwest'];
function headAxis(p){
  let top=p.height,bottom=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>128){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  let left=p.width,right=0;const limit=top+Math.round((bottom-top)*.2);
  for(let y=top;y<=limit;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
  return (left+right)/2;
}
async function extract(file,columns,rows,cell){
  const source=PNG.sync.read(fs.readFileSync(file));
  const x0=Math.floor((cell%columns)*source.width/columns),x1=Math.floor((cell%columns+1)*source.width/columns);
  const y0=Math.floor(Math.floor(cell/columns)*source.height/rows),y1=Math.floor((Math.floor(cell/columns)+1)*source.height/rows);
  const p=new PNG({width:x1-x0,height:y1-y0});PNG.bitblt(source,p,x0,y0,p.width,p.height,0,0);
  let left=p.width,top=p.height,right=0,bottom=0;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
    const i=(y*p.width+x)*4,[r,g,b,a]=p.data.subarray(i,i+4);
    if(!a || (g>130&&b>130&&g-r>75&&b-r>75)){p.data[i+3]=0;continue;}
    if(a>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(right<=left||bottom<=top)throw Error(`Empty frame ${file}/${cell}`);
  const trim=new PNG({width:right-left+1,height:bottom-top+1});PNG.bitblt(p,trim,left,top,trim.width,trim.height,0,0);
  return trim;
}
async function main(){
  const manifestPath=process.argv[2],output=process.argv[3];
  if(!manifestPath||!output)throw Error('Usage: node scripts/import-ron-walks.cjs manifest.json output.png');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const base=PNG.sync.read(fs.readFileSync(manifest.base));
  const records=[];
  for(const [direction,specs]of Object.entries(manifest.directions)){
    const row=dirs.indexOf(direction);if(row<0||specs.length!==8)throw Error(`Invalid direction ${direction}`);
    const idle=new PNG({width:192,height:256});PNG.bitblt(base,idle,0,row*256,192,256,0,0);
    const anchor=headAxis(idle);
    for(const [i,spec]of specs.entries()){
      const trim=await extract(spec.file,spec.columns??1,spec.rows??1,spec.cell??0);
      const scale=Math.min((spec.height??216)/trim.height,174/trim.width);
      const width=Math.round(trim.width*scale),height=Math.round(trim.height*scale);
      const resized=PNG.sync.read(await sharp(PNG.sync.write(trim)).resize(width,height,{kernel:'nearest'}).png().toBuffer());
      const cellX=(i+4)*192,cellY=row*256,x=Math.round(anchor-headAxis(resized))+(spec.dx??0),y=238-height+(spec.dy??0);
      if(x<2||x+width>190||y<2||y+height>254)throw Error(`Clipping ${direction}/${i+1}`);
      for(let cy=0;cy<256;cy++)base.data.fill(0,((cellY+cy)*base.width+cellX)*4,((cellY+cy)*base.width+cellX+192)*4);
      PNG.bitblt(resized,base,0,0,width,height,cellX+x,cellY+y);
      records.push({direction,frame:i+1,x,y,width,height,source:spec});
    }
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,PNG.sync.write(base));
  const boundsOutput=path.resolve(output)===path.resolve('src/assets/sprites/ron/ron-atlas.png')
    ?'docs/ron-animation/walk-revisions/packed-bounds.json':output.replace(/\.png$/,'.bounds.json');
  fs.writeFileSync(boundsOutput,JSON.stringify(records,null,2)+'\n');
  console.log(`Packed ${records.length} walk frames into ${output}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
