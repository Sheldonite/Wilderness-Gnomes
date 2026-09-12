// Verifies the shipped sprite pixels against the independently reviewed candidates, following the
// head-lock log when scripts/ron-lock-heads.py has been applied.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const dirs=['south','southeast','east','northeast','north','northwest','west','southwest'];
const read=file=>PNG.sync.read(fs.readFileSync(file));
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function frame(a,row,col){const p=new PNG({width:192,height:256});PNG.bitblt(a,p,col*192,row*256,192,256,0,0);return p;}
const atlasPath=process.argv[2]??'src/assets/sprites/ron/ron-atlas.png';
const baselinePath=process.argv[3];
const atlas=read(atlasPath),baseline=baselinePath?read(baselinePath):null;
// scripts/ron-lock-heads.py ships head-locked walk frames and de-fringed south idles. Its log ties each
// shipped frame back to the reviewed pixels it was derived from, so the review chain stays checkable.
const production=path.resolve(atlasPath)===path.resolve('src/assets/sprites/ron/ron-atlas.png');
const lockPath=process.env.RON_HEADLOCK_LOG??(production?'docs/ron-animation/headlock/headlock-log.json':atlasPath.replace(/\.png$/,'.headlock-log.json'));
const lock=fs.existsSync(lockPath)?JSON.parse(fs.readFileSync(lockPath,'utf8')):null;
const lockedWalk=(direction,n)=>lock?.walk.find(e=>e.direction===direction&&e.frame===n);
const defringed=(direction,n)=>lock?.idle.find(e=>e.direction===direction&&e.frame===n&&e.removed>0);
assert.equal(atlas.width,2304);assert.equal(atlas.height,2048);
const results=[];
for(const [row,direction]of dirs.entries()){
  const approval=JSON.parse(fs.readFileSync(`docs/ron-animation/critique/${direction}-approved.json`,'utf8'));
  assert.equal(approval.passed,true,`${direction} approval`);
  assert.equal(approval.frames.length,8,`${direction} scores`);
  const hasFrameHashes=approval.frames.every(f=>f.rgbaSha256);
  const reviewed=hasFrameHashes?null:read(approval.source);
  if(reviewed)assert.equal(hash(fs.readFileSync(approval.source)).toUpperCase(),approval.sha256.toUpperCase(),`${direction} reviewed source hash`);
  for(let col=0;col<12;col++){
    const p=frame(atlas,row,col),digest=hash(p.data);
    if(col<4){
      const edit=defringed(direction,col+1);
      if(edit)assert.equal(digest,edit.resultSha256,`${direction} idle${col+1} is not its logged de-fringe`);
      if(baseline)assert.equal(edit?edit.sourceSha256:digest,hash(frame(baseline,row,col).data),`${direction} idle${col+1} changed`);
      continue;
    }
    const score=approval.frames.find(f=>f.frame===col-3)?.score;
    assert.ok(score>=8,`${direction} walk${col-3} score ${score}`);
    const expected=(approval.frames.find(f=>f.frame===col-3)?.rgbaSha256??hash(frame(reviewed,row,col).data)).toLowerCase();
    const locked=lockedWalk(direction,col-3);
    if(lock){
      assert.ok(locked,`${direction} walk${col-3} missing from ${lockPath}`);
      assert.equal(locked.sourceSha256,expected,`${direction} walk${col-3} head lock did not start from reviewed pixels`);
      assert.equal(digest,locked.resultSha256,`${direction} walk${col-3} not the logged head-locked pixels`);
    }else assert.equal(digest,expected,`${direction} walk${col-3} not reviewed pixels`);
    let occupied=0,minX=192,minY=256,maxX=0,maxY=0;
    for(let y=0;y<256;y++)for(let x=0;x<192;x++)if(p.data[(y*192+x)*4+3]>128){occupied++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    assert.ok(occupied>1000&&minX>0&&minY>0&&maxX<191&&maxY<255,`${direction} walk${col-3} empty/clipped`);
    results.push({direction,frame:col-3,score,sha256:digest,...(lock?{reviewedSha256:expected}:{}),bounds:{minX,minY,maxX,maxY}});
  }
}
assert.equal(new Set(results.map(r=>r.sha256)).size,64,'Duplicated walking frames');
const edits=lock?lock.idle.filter(e=>e.removed>0).length:0;
const headLock=lock?{log:lockPath,walkFramesLocked:lock.walk.length,idleFramesDefringed:edits,bodyShifts:lock.walk.filter(e=>e.bodyShift).map(e=>({direction:e.direction,frame:e.frame,shift:e.bodyShift}))}:null;
fs.writeFileSync('docs/ron-animation/critique/validation.json',JSON.stringify({atlas:atlasPath,atlasSha256:hash(fs.readFileSync(atlasPath)),walkFrames:64,idleFramesUnchanged:baseline?32-edits:null,allReviewedPixelsMatch:true,allScoresAtLeast8:true,headLock,frames:results},null,2)+'\n');
console.log((lock?`64 distinct unclipped head-locked frames trace to reviewer-approved pixels through ${lockPath}`:'64 distinct unclipped frames match reviewer-approved pixels')+'; all scores >=8; '+(baseline?`${32-edits} idle frames unchanged${edits?`, ${edits} de-fringed as logged`:''}.`:'idle baseline not supplied.'));
