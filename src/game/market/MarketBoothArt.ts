import Phaser from 'phaser';
import { MARKET_VENDORS, type MarketVendorId } from '../config/marketItems';

const palettes: Record<MarketVendorId, [string, string]> = {
  forge: ['#c46639', '#713d32'], outfitter: ['#b9719b', '#68465f'],
  apothecary: ['#609e85', '#355e51'], curios: ['#7788bd', '#444f80']
};

/** Oversampled, smooth storybook artwork; separate layers leave room for the shopkeeper. */
export function makeMarketBoothArt(scene: Phaser.Scene): void {
  for (const vendor of MARKET_VENDORS) for (const layer of ['back', 'front']) {
    const key = `market-stall-${vendor.id}-${layer}`;
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, 720, 630)!;
    const c = texture.context;
    c.scale(3, 3); c.lineCap = 'round'; c.lineJoin = 'round';
    const [cloth, shade] = palettes[vendor.id];
    const cream = '#fff1ca', gold = '#eac27b', ink = '#583d35';
    const shape = (path: string, fill: string, stroke = ink, width = 1.5) => {
      const p = new Path2D(path); c.fillStyle = fill; c.fill(p);
      if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p); }
    };
    const box = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke = ink) => {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
      c.strokeStyle = stroke; c.lineWidth = 1.3; c.stroke();
    };
    const ellipse = (x: number, y: number, rx: number, ry: number, fill: string) => {
      c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=fill; c.fill();
    };
    const line = (path: string, color: string, width = 1.5) => {
      c.strokeStyle=color; c.lineWidth=width; c.stroke(new Path2D(path));
    };
    const star = (x: number, y: number, size: number, color = gold) => {
      shape(`M${x} ${y-size} Q${x+1} ${y-1} ${x+size} ${y} Q${x+1} ${y+1} ${x} ${y+size} Q${x-1} ${y+1} ${x-size} ${y} Q${x-1} ${y-1} ${x} ${y-size}`,color,color,.5);
    };
    const sword = (x: number, y: number, angle: number) => {
      c.save(); c.translate(x,y); c.rotate(angle);
      shape('M0 -26 L5 -18 L3 9 L-3 9 L-5 -18 Z','#dce8e5');
      line('M0 -21 L0 8','#ffffff',1.4); box(-10,8,20,4,2,gold); box(-2,12,4,9,1,'#95634d'); ellipse(0,23,4,3,gold); c.restore();
    };
    const hat = (x: number,y: number, color: string) => {
      c.save(); c.translate(x,y);
      shape('M-16 2 Q-7 -12 -3 -28 Q4 -19 15 -17 Q8 -13 16 2 Z',color);
      ellipse(0,3,22,5,shade); line('M-12 -1 Q0 3 12 -1',gold,3); star(2,-12,3); c.restore();
    };
    const bottle = (x: number,y: number,color: string) => {
      c.save(); c.translate(x,y);
      shape('M-4 -23 L4 -23 L4 -15 C20 -7 14 6 0 6 C-14 6 -20 -7 -4 -15 Z',color);
      box(-5,-26,10,5,1,gold); line('M-8 -10 Q-13 -3 -7 0','#fff5d6',2); star(2,-3,4,cream); c.restore();
    };
    const portrait = (x: number,y: number,color: string) => {
      box(x-12,y-16,24,32,3,cream); ellipse(x,y-5,5,6,'#d49a74');
      shape(`M${x-8} ${y+12} Q${x-9} ${y+1} ${x} ${y+1} Q${x+9} ${y+1} ${x+8} ${y+12} Z`,color,color,0);
      line(`M${x-6} ${y-10} Q${x} ${y-19} ${x+6} ${y-10}`,shade,3);
    };
    if (layer === 'back') {
      box(31,57,178,138,9,'#94694d');
      const wood = c.createLinearGradient(30,70,210,190); wood.addColorStop(0,'#bb8b5d'); wood.addColorStop(1,'#6e493a');
      c.fillStyle=wood; c.fillRect(38,70,164,115);
      for(let x=46;x<201;x+=19) line(`M${x} 78 Q${x-3} 115 ${x} 168`,'#d6aa7538');
      box(39,144,162,6,2,'#d4a16b');
      for(const x of [28,204]) { box(x,59,8,138,4,'#b78a58'); line(`M${x+2} 70 L${x+2} 188`,'#edc78b'); ellipse(x+4,60,7,7,gold); }
      // A curved canopy with tapered stripes and soft shaded folds.
      const roof='M40 36 Q120 8 200 36 L227 81 Q120 99 13 81 Z';
      shape(roof,cloth);
      c.save(); c.clip(new Path2D(roof));
      for(let i=0;i<7;i++) {
        const x=39+i*24;
        shape(`M${x} 25 L${x+12} 25 L${20+i*30+19} 94 L${20+i*30} 94 Z`,i%2?cream:shade,cloth,0);
      }
      const glow=c.createLinearGradient(0,25,0,96); glow.addColorStop(0,'#fff9d650'); glow.addColorStop(.5,'#fff9d600'); glow.addColorStop(1,'#30223645');
      c.fillStyle=glow;c.fillRect(0,20,240,85); c.restore();
      for(let i=0;i<9;i++) {
        const x=13+i*23.8;
        shape(`M${x} 81 L${x+23.8} 81 L${x+23.8} 90 Q${x+12} 104 ${x} 90 Z`,i%2?cream:cloth,shade,.8);
        ellipse(x+12,96,1.8,2.5,gold);
      }
      line('M14 81 Q120 93 226 81',gold,2.3);
      // A crest and readable sign make each trade recognizable from the square.
      ellipse(120,36,22,22,shade); ellipse(120,36,19,19,gold); ellipse(120,36,16.5,16.5,cream);
      c.save(); c.translate(120,36); c.scale(.52,.52);
      if(vendor.id==='forge'){sword(-3,0,-.55);sword(3,0,.55);}
      else if(vendor.id==='outfitter')hat(0,7,cloth);
      else if(vendor.id==='apothecary')bottle(0,7,cloth);
      else {portrait(-8,0,cloth);portrait(9,4,shade);}
      c.restore();
      line('M58 96 L58 106 M182 96 L182 106',gold,2);
      box(43,103,154,24,7,cream); box(46,106,148,18,5,shade);
      c.fillStyle=cream; c.textAlign='center'; c.textBaseline='middle';
      c.font=`bold ${vendor.id==='curios'?12:15}px Georgia, serif`;
      c.fillText(vendor.name,120,116,141);
      if(vendor.id==='forge') {sword(59,149,-.15); sword(80,151,.2); shape('M165 128 Q179 123 193 128 L190 148 Q180 162 168 148 Z',cloth); star(180,140,8);}
      else if(vendor.id==='outfitter') {hat(62,148,'#d796ae');hat(181,148,'#88b9a1');line('M96 134 Q120 140 144 134',gold);star(102,143,4);star(137,143,4);}
      else if(vendor.id==='apothecary') {bottle(57,147,'#96ccb0');bottle(81,148,'#d7a7c7');bottle(179,146,'#8cc2d8');star(158,133,5);star(194,128,3);}
      else {portrait(58,144,'#a789c0');portrait(85,144,'#77a990');box(160,130,34,24,2,cream);line('M165 137 L189 137 M165 143 L185 143 M165 148 L180 148',shade,1);}
      for(const x of [19,221]) {
        line(`M${x} 91 L${x} 111`,ink); ellipse(x,121,10,14,'#ffe9a12b');
        box(x-5,112,10,15,3,'#ffe2a1'); line(`M${x} 115 L${x} 123`,'#fffbe1',3);
        box(x-6,110,12,3,1,gold);box(x-6,126,12,3,1,gold);
      }
    } else {
      box(33,169,174,34,4,'#956045');
      box(28,166,184,8,3,'#edc184');line('M34 168 L207 168','#fff0bf');
      shape('M47 175 L193 175 L191 201 Q170 208 149 201 Q120 211 92 201 Q70 208 49 201 Z',cloth,shade);
      line('M54 180 L186 180 M55 199 Q72 203 91 197 Q120 206 150 197 Q171 204 184 198',gold,1.5);
      for(const x of [61,179])star(x,190,5);
      c.fillStyle=cream;c.textAlign='center';c.font='bold 8px Georgia, serif';
      c.fillText(vendor.id==='curios'?'CHARACTER UNLOCKS':vendor.id==='outfitter'?'A LITTLE EXTRA MAGIC':vendor.id==='forge'?'READY FOR ADVENTURE':'GROW A LITTLE STRONGER',120,193);
      if(vendor.id==='forge'){shape('M48 152 L90 152 L82 159 L74 160 L76 165 L58 165 L61 159 L51 158 Z','#829b9d');sword(176,159,1.1);}
      else if(vendor.id==='outfitter'){hat(64,163,'#b982bd');box(160,157,28,7,2,'#9abda3');box(164,151,26,6,2,'#e4abc0');}
      else if(vendor.id==='apothecary'){bottle(61,159,'#a1d8aa');bottle(183,159,'#a9b7ea');}
      else {box(47,153,37,12,3,'#f6dfb3');line('M52 157 L77 157 M52 161 L73 161',shade);line('M176 163 L181 143',ink,2);shape('M178 148 Q177 136 188 136 Q186 146 178 148',cream);ellipse(176,164,7,3,shade);}
    }
    texture.refresh().setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
