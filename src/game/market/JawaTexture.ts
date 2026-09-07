import Phaser from 'phaser';

export const JAWA_BUDDY_TEXTURE='cosmetic-jawa-buddy';

export function createJawaBuddyTexture(scene:Phaser.Scene):void {
  if(scene.textures.exists(JAWA_BUDDY_TEXTURE))return;
  const texture=scene.textures.createCanvas(JAWA_BUDDY_TEXTURE,192,192)!;
  const c=texture.context;c.scale(3,3);c.lineJoin='round';c.lineCap='round';
  const shape=(path:string,color:string)=>{
    const p=new Path2D(path);c.fillStyle=color;c.fill(p);c.strokeStyle='#111c32';c.lineWidth=1.3;c.stroke(p);
  };
  // A roomy hood above a slim, softly tapered robe and tiny tucked-in hands.
  shape('M24 29 Q21 40 19 56 Q32 60 45 56 L40 30 Z','#20365b');
  shape('M24 34 Q19 39 18 48 L23 50 L28 35 Z','#365681');
  shape('M39 34 Q44 39 46 47 L42 50 L36 35 Z','#2c4870');
  shape('M18 29 Q15 16 24 10 Q28 5 34 6 Q45 10 47 23 Q49 31 42 34 Q30 39 18 29 Z','#2b456e');
  shape('M22 27 Q19 17 30 14 Q41 13 43 25 Q43 32 33 33 Q25 33 22 27 Z','#101521');
  c.strokeStyle='#6f8fb7';c.lineWidth=1.5;c.beginPath();c.moveTo(20,22);c.quadraticCurveTo(21,12,32,9);c.stroke();
  for(const x of [27,38]) {
    const glow=c.createRadialGradient(x,24,0,x,24,6);
    glow.addColorStop(0,'#fff7a4');glow.addColorStop(.35,'#ffcf38b0');glow.addColorStop(1,'#ffb31a00');
    c.fillStyle=glow;c.fillRect(x-6,18,12,12);
    c.fillStyle='#ffe878';c.beginPath();c.ellipse(x,24,2.6,3,0,0,Math.PI*2);c.fill();
    c.fillStyle='#fffbd8';c.beginPath();c.arc(x-.6,23.1,.85,0,Math.PI*2);c.fill();
  }
  shape('M25 35 L29 34 L40 53 L36 55 Z','#51362b');
  for(let i=0;i<3;i++)shape(`M${26+i*3} ${38+i*5} l5 -1.5 l1 4 l-5 1.5 Z`,'#b58a50');
  c.strokeStyle='#5478a1';c.lineWidth=1.2;
  for(const x of [26,33,40]){c.beginPath();c.moveTo(x,46);c.lineTo(x-2,55);c.stroke();}
  shape('M20 46 Q17 45 17 49 Q18 52 22 50 Z','#30231d');
  shape('M43 46 Q46 44 47 48 Q46 51 42 50 Z','#30231d');
  texture.refresh().setFilter(Phaser.Textures.FilterMode.LINEAR);
}
