// Engine import: isolate generated cells, key the backdrop, align and pack.
// Set NODE_PATH to a directory containing pngjs and sharp when running this tool.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const directions = ['south','southeast','east','northeast','north','northwest','west','southwest'];
const out = path.join(root, 'src/assets/sprites/ron');
const sourceDir = path.join(root, 'docs/ron-animation/sources');
function ranges(counts, gap = 20) {
  const groups = [];
  for (let i=0;i<counts.length;i++) if(counts[i]>2) {
    const last=groups.at(-1);
    if(last && i-last[1]<=gap) last[1]=i; else groups.push([i,i]);
  }
  return groups.filter(([a,b])=>b-a>30);
}
async function main() {
  const atlas = new PNG({width:2304,height:2048});
  const bounds=[];
  for(const [directionRow,direction] of directions.entries()) {
    const img=PNG.sync.read(fs.readFileSync(path.join(sourceDir,`${direction}.png`)));
    const {width:w,height:h,data}=img;
    // Flood from backdrop edges so Ron's ivory shirt is retained in the south source.
    const candidate=new Uint8Array(w*h), removed=new Uint8Array(w*h), queue=new Int32Array(w*h);
    for(let p=0;p<w*h;p++) {
      const [r,g,b,a]=data.subarray(p*4,p*4+4);
      candidate[p]=a===0 || (direction==='south' ? Math.min(r,g,b)>205 && Math.max(r,g,b)-Math.min(r,g,b)<22 : g>140 && b>140 && g-r>90 && b-r>90) ? 1 : 0;
    }
    let n=0;
    function add(p){if(candidate[p]&&!removed[p]){removed[p]=1;queue[n++]=p;}}
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
    for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    for(let i=0;i<n;i++) {const p=queue[i],x=p%w,y=Math.floor(p/w);if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<h-1)add(p+w);}
    for(let p=0;p<w*h;p++) if(removed[p] || (direction!=='south'&&candidate[p])) data[p*4+3]=0;
    const ys=new Uint32Array(h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>128)ys[y]++;
    const rows=ranges(ys,12);
    if(rows.length!==3)throw Error(`${direction}: expected 3 rows, got ${JSON.stringify(rows)}`);
    const cells=[];
    for(const [top,bottom] of rows) {
      const xs=new Uint32Array(w);
      for(let y=top;y<=bottom;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>128)xs[x]++;
      const columns=ranges(xs,30);
      if(columns.length!==4)throw Error(`${direction}: expected 4 columns, got ${JSON.stringify(columns)}`);
      for(const [left,right] of columns) {
        let t=bottom,b=top;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(data[(y*w+x)*4+3]>128){t=Math.min(t,y);b=Math.max(b,y);}
        const cell=new PNG({width:right-left+1,height:b-t+1});
        PNG.bitblt(img,cell,left,t,cell.width,cell.height,0,0);cells.push(cell);
      }
    }
    // One uniform scale per direction keeps the same pixel scale across each loop.
    const heights=cells.map(c=>c.height).sort((a,b)=>a-b);
    const scale=Math.min(216/heights[6],176/Math.max(...cells.map(c=>c.width)),224/Math.max(...cells.map(c=>c.height)));
    for(const [i,cell] of cells.entries()) {
      const width=Math.round(cell.width*scale),height=Math.round(cell.height*scale);
      const resized=PNG.sync.read(await sharp(PNG.sync.write(cell)).resize(width,height,{kernel:'nearest'}).png().toBuffer());
      const x=Math.floor((192-width)/2),y=238-height;
      if(x<4||y<4)throw Error('Clipped cell');
      PNG.bitblt(resized,atlas,0,0,width,height,i*192+x,directionRow*256+y);
      bounds.push({direction,frame:i,x,y,width,height,bottom:238});
    }
    console.log(`${direction}: 12 aligned frames`);
  }
  fs.writeFileSync(path.join(out,'ron-atlas.png'),PNG.sync.write(atlas));
  fs.writeFileSync(path.join(root,'docs/ron-animation/bounds.json'),JSON.stringify(bounds,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
