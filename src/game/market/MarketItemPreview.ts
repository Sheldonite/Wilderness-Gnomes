import type Phaser from 'phaser';
import { getPlayerCharacter } from '../config/playerCharacters';
import type { MarketItem } from '../config/marketItems';

/** Small previews use the same character frames and parcel texture as the game. */
export function marketItemPreview(scene: Phaser.Scene, item: MarketItem, wearerId: string): string | null {
  if(item.kind!=='character' && item.kind!=='cosmetic') return null;
  const canvas=document.createElement('canvas');canvas.width=280;canvas.height=220;
  const c=canvas.getContext('2d')!;c.scale(2,2);
  const frame=(f:Phaser.Textures.Frame,x:number,bottom:number,maxWidth:number,height:number)=>{
    const scale=Math.min(maxWidth/f.cutWidth,height/f.cutHeight),w=f.cutWidth*scale,h=f.cutHeight*scale;
    c.drawImage(f.source.image as CanvasImageSource,f.cutX,f.cutY,f.cutWidth,f.cutHeight,x-w/2,bottom-h,w,h);
  };
  const person=(id:string,x:number,bottom:number,height:number)=>{
    const character=getPlayerCharacter(id);
    const idle=scene.anims.get(character.idleAnimation.key)?.frames[0]?.frame;
    frame(idle??scene.textures.getFrame(character.textureKey,0),x,bottom,65,height);
  };
  const ellipse=(x:number,y:number,rx:number,ry:number,color:string)=>{
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
  };
  const star=(x:number,y:number,size:number,color:string)=>{
    c.strokeStyle=color;c.lineWidth=1.2;c.lineCap='round';c.beginPath();
    c.moveTo(x-size,y);c.lineTo(x+size,y);c.moveTo(x,y-size);c.lineTo(x,y+size);c.stroke();
    ellipse(x,y,.8,.8,'#fffcef');
  };
  if(item.kind==='character') {
    ellipse(70,99,26,5,'#172e3624');
    person(item.id==='unlock-sheldon'?'sheldon':'hailey',70,101,97);
  } else if(item.id==='ups-buddy'||item.id==='jawa-buddy') {
    ellipse(70,100,31,6,'#172e3624');
    c.strokeStyle='#765134';c.lineWidth=4;c.lineCap='round';
    for(const x of (item.id==='jawa-buddy'?[64,78]:[60,82])){c.beginPath();c.moveTo(x,80);c.lineTo(x,97);c.stroke();ellipse(x+2,99,item.id==='jawa-buddy'?6:8,4,'#563b29');}
    frame(scene.textures.getFrame(item.id==='jawa-buddy'?'cosmetic-jawa-buddy':'cosmetic-ups-parcel'),70,99,105,105);
  } else if(item.id==='glitter-trail') {
    for(let i=0;i<25;i++) {
      const x=15+i*3.8,y=87+Math.sin(i*1.8)*10-i*.35;
      c.globalAlpha=.25+i/34;star(x,y,1.8+i%3*.5,['#ffe6a0','#f6b9ee','#d4beff','#ffffff'][i%4]);
    }
    c.globalAlpha=1;person(wearerId,107,88,73);
  } else {
    const gold=item.id==='honey-glow', color=gold?'#ffd46b':'#c69bff';
    const glow=c.createRadialGradient(70,89,0,70,89,42);
    glow.addColorStop(0,gold?'#ffd46b70':'#c69bff70');glow.addColorStop(1,'#ffffff00');
    c.fillStyle=glow;c.fillRect(20,50,100,60);
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(70,91,33,10,0,0,Math.PI*2);c.stroke();
    person(wearerId,70,94,80);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;star(70+Math.cos(a)*36,86+Math.sin(a)*12,3,color);}
  }
  return canvas.toDataURL('image/png');
}
